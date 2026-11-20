/**
 * YAI Studio V1 — Model Download Pipeline
 *
 * Implements a genuine streaming model download with:
 *   - Live progress reporting (bytes received, total bytes, percent, speed)
 *   - Incremental chunk writing to OPFS via createWritable()
 *   - SHA-256 verification after download completes (via Web Crypto)
 *   - Atomic promotion from .tmp to final file on successful verification
 *   - Full cleanup on failure, cancellation or interruption
 *   - HTTP Range request support for resume where the server allows it
 *   - AbortController cancellation
 *   - Storage quota pre-check before starting
 *
 * The expected SHA-256 checksum for each model is embedded in the
 * local-model-registry.ts descriptor. These are sourced from the
 * Hugging Face Git LFS pointer files (which contain the oid sha256 field).
 *
 * Authoritative SHA-256 values confirmed from:
 *   huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/raw/main/gemma-4-E2B-it-web.litertlm
 *     → oid sha256:3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5
 *   huggingface.co/litert-community/granite-4.0-350m-litert-lm/raw/main/granite-4.0-350m_q8_ekv1280.litertlm
 *     → oid sha256:c8e9a29493f62b7c44461fb36980987c4c1454c75e95f57ba0539a8edc9dce76
 */

import { hashOpfsFile, constantTimeHexEqual } from './sha256-stream';
import {
  getTmpFileHandle,
  promoteTemporaryFile,
  deleteModelFromOpfs,
  cleanupTmpFile,
  isOpfsAvailable,
  requestPersistentStorage,
} from './model-storage';
import { getLocalModelDescriptor, isModelSupported } from './local-model-registry';
import type { InstalledModelRecord } from './types';

// Needed to access the per-model OPFS directory handle with create flag
// model-storage exports getModelDir but not all its internals — we re-use
// only the public API here.
// Re-export for convenience
export type { InstalledModelRecord };

/** How often (ms) to emit progress updates during chunk processing. */
const PROGRESS_EMIT_INTERVAL_MS = 250;

export interface DownloadProgressEvent {
  modelId: string;
  status: 'downloading' | 'verifying' | 'ready' | 'error';
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeedBytesPerSec: number;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  modelId: string;
  totalBytes: number;
  durationMs: number;
  checksumVerified: boolean;
  error?: string;
}

/** Active download controllers keyed by modelId. */
const activeControllers = new Map<string, AbortController>();

/**
 * Returns true if a download for this modelId is currently in progress.
 */
export function isDownloadActive(modelId: string): boolean {
  return activeControllers.has(modelId);
}

/**
 * Cancels an in-progress download for the given modelId.
 * Has no effect if no download is active.
 */
export async function cancelDownload(modelId: string): Promise<void> {
  const controller = activeControllers.get(modelId);
  if (controller) {
    controller.abort();
    activeControllers.delete(modelId);
  }
  // Clean up any partial file
  await cleanupTmpFile(modelId);
}

/**
 * User-initiated model download pipeline.
 *
 * Downloads the model binary from the descriptor's downloadUrl, writing
 * chunks directly to an OPFS temporary file without buffering in RAM.
 * On completion, verifies SHA-256, and atomically promotes the file.
 *
 * @param modelId       Catalog model ID (must exist and be supported).
 * @param onProgress    Callback invoked with live progress events.
 * @returns             DownloadResult with success/failure details.
 */
export async function downloadModel(
  modelId: string,
  onProgress?: (event: DownloadProgressEvent) => void
): Promise<DownloadResult> {
  const startMs = performance.now();

  if (!isOpfsAvailable()) {
    return errorResult(modelId, 'Origin Private File System (OPFS) is not available in this browser.', startMs);
  }

  if (activeControllers.has(modelId)) {
    return errorResult(modelId, 'A download for this model is already in progress.', startMs);
  }

  const descriptor = getLocalModelDescriptor(modelId);
  if (!descriptor) {
    return errorResult(modelId, `Model "${modelId}" is not in the local catalog.`, startMs);
  }

  if (!isModelSupported(modelId)) {
    return errorResult(
      modelId,
      descriptor.unsupportedReason ?? 'This model is not supported by the current LiteRT-LM Web runtime.',
      startMs
    );
  }

  if (!descriptor.downloadUrl) {
    return errorResult(modelId, 'No download URL is configured for this model.', startMs);
  }

  if (!descriptor.sha256) {
    return errorResult(modelId, 'No expected checksum is available for this model. Download refused to protect integrity.', startMs);
  }

  // Pre-check storage quota
  try {
    const estimate = await navigator.storage.estimate();
    const available = (estimate.quota ?? 0) - (estimate.usage ?? 0);
    if (available > 0 && available < descriptor.downloadSizeBytes) {
      return errorResult(
        modelId,
        `Insufficient browser storage. Required: ${formatBytes(descriptor.downloadSizeBytes)}, ` +
          `available: ${formatBytes(available)}.`,
        startMs
      );
    }
  } catch {
    // quota check is best-effort
  }

  // Request persistent storage before large download
  await requestPersistentStorage();

  const controller = new AbortController();
  activeControllers.set(modelId, controller);

  try {
    const result = await runDownload(modelId, descriptor.downloadUrl, descriptor.sha256, descriptor.downloadSizeBytes, controller.signal, onProgress, startMs);
    return result;
  } catch (err) {
    await cleanupTmpFile(modelId);
    const msg = err instanceof Error ? err.message : String(err);
    onProgress?.({
      modelId,
      status: 'error',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: descriptor.downloadSizeBytes,
      downloadSpeedBytesPerSec: 0,
      error: msg,
    });
    return errorResult(modelId, msg, startMs);
  } finally {
    activeControllers.delete(modelId);
  }
}

/** Core download execution. Separated for testability. */
async function runDownload(
  modelId: string,
  url: string,
  expectedSha256: string,
  expectedSize: number,
  signal: AbortSignal,
  onProgress: ((event: DownloadProgressEvent) => void) | undefined,
  startMs: number
): Promise<DownloadResult> {

  // Determine if we can resume from a partial tmp file
  let startByte = 0;
  const tmpHandle = await getTmpFileHandle(modelId, true);

  if (tmpHandle) {
    try {
      const tmpFile = await tmpHandle.getFile();
      if (tmpFile.size > 0 && tmpFile.size < expectedSize) {
        // Probe server for Range support
        const headRes = await fetch(url, { method: 'HEAD', signal });
        if (headRes.headers.get('Accept-Ranges') === 'bytes') {
          startByte = tmpFile.size;
        }
      }
    } catch {
      startByte = 0;
    }
  }

  const headers: Record<string, string> = {};
  if (startByte > 0) {
    headers['Range'] = `bytes=${startByte}-`;
  }

  const response = await fetch(url, { headers, signal });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('Response body is empty; cannot stream download.');
  }

  const contentLength = response.headers.get('Content-Length');
  const totalBytes = contentLength ? startByte + parseInt(contentLength, 10) : expectedSize;

  // Open OPFS tmp file for writing (append from startByte if resuming)
  const modelDir = await getModelDirCreating(modelId);
  const finalTmpHandle = await modelDir.getFileHandle('model.tmp.litertlm', { create: true });
  const writable = await finalTmpHandle.createWritable({ keepExistingData: startByte > 0 });

  if (startByte > 0) {
    await writable.seek(startByte);
  }

  const reader = response.body.getReader();
  let downloadedBytes = startByte;
  let speedWindowBytes = 0;
  let lastProgressMs = performance.now();
  let speedWindowStartMs = performance.now();

  try {
    while (true) {
      if (signal.aborted) {
        await writable.close();
        throw new Error('Download cancelled by user.');
      }

      const { done, value } = await reader.read();
      if (done) break;

      await writable.write(value);
      downloadedBytes += value.byteLength;
      speedWindowBytes += value.byteLength;

      const now = performance.now();
      if (now - lastProgressMs >= PROGRESS_EMIT_INTERVAL_MS) {
        const elapsedSec = (now - speedWindowStartMs) / 1000;
        const speedBps = elapsedSec > 0 ? speedWindowBytes / elapsedSec : 0;
        speedWindowBytes = 0;
        speedWindowStartMs = now;
        lastProgressMs = now;

        onProgress?.({
          modelId,
          status: 'downloading',
          progressPercent: totalBytes > 0 ? Math.min(99, (downloadedBytes / totalBytes) * 100) : 0,
          downloadedBytes,
          totalBytes,
          downloadSpeedBytesPerSec: speedBps,
        });
      }
    }
  } finally {
    reader.releaseLock();
    await writable.close();
  }

  if (signal.aborted) {
    throw new Error('Download cancelled by user.');
  }

  // Verify checksum
  onProgress?.({
    modelId,
    status: 'verifying',
    progressPercent: 99,
    downloadedBytes,
    totalBytes,
    downloadSpeedBytesPerSec: 0,
  });

  const actualSha256 = await hashOpfsFile(finalTmpHandle);

  if (!constantTimeHexEqual(actualSha256, expectedSha256.toLowerCase())) {
    await cleanupTmpFile(modelId);
    throw new Error(
      `SHA-256 checksum mismatch. The downloaded file is corrupt or was tampered with.\n` +
        `Expected: ${expectedSha256}\n` +
        `Received: ${actualSha256}`
    );
  }

  // Atomically promote tmp → final
  await promoteTemporaryFile(modelId);

  const durationMs = Math.round(performance.now() - startMs);

  onProgress?.({
    modelId,
    status: 'ready',
    progressPercent: 100,
    downloadedBytes,
    totalBytes,
    downloadSpeedBytesPerSec: 0,
  });

  return {
    success: true,
    modelId,
    totalBytes: downloadedBytes,
    durationMs,
    checksumVerified: true,
  };
}

/** Gets (or creates) a model's OPFS subdirectory. */
async function getModelDirCreating(modelId: string): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await navigator.storage.getDirectory();
  const root = await opfsRoot.getDirectoryHandle('yai-models', { create: true });
  return root.getDirectoryHandle(modelId, { create: true });
}

function errorResult(modelId: string, error: string, startMs: number): DownloadResult {
  return {
    success: false,
    modelId,
    totalBytes: 0,
    durationMs: Math.round(performance.now() - startMs),
    checksumVerified: false,
    error,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${bytes} bytes`;
}

// Re-export model deletion for the UI/manager layer
export { deleteModelFromOpfs };
