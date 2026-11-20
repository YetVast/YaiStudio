/**
 * YAI Studio V1 — OPFS Model Storage
 *
 * Manages on-disk binary storage of local LiteRT-LM model files using the
 * Origin Private File System (OPFS) API. OPFS is a sandboxed, persistent
 * directory that survives browser reloads without occupying the user-visible
 * filesystem.
 *
 * API contract with @litert-lm/core:
 *   Engine.create({ model: Blob | ReadableStream<Uint8Array> | string | ModelSource })
 *   We retrieve models as a `File` (which extends Blob) for compatibility.
 *
 * Directory layout inside OPFS:
 *   yai-models/
 *     <modelId>/
 *       model.litertlm      ← the verified binary artifact
 *       model.tmp.litertlm  ← temporary file during active download
 *       metadata.json       ← stored separately from the binary
 *
 * Design invariants:
 *   - Only a fully downloaded and checksum-verified file is promoted from
 *     .tmp to the final filename.
 *   - Metadata records are stored in localStorage (not OPFS) to allow fast
 *     synchronous state reads from React components.
 *   - Actual storage bytes are computed from OPFS file size, not estimates.
 */

export interface OpfsModelInfo {
  modelId: string;
  sizeBytes: number;
  storedAt: string;
  checksumVerified: boolean;
}

const ROOT_DIR = 'yai-models';

/** Opens (or creates) the root yai-models directory in OPFS. */
async function getRootDir(): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await navigator.storage.getDirectory();
  return opfsRoot.getDirectoryHandle(ROOT_DIR, { create: true });
}

/** Opens the per-model subdirectory. */
async function getModelDir(
  modelId: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  const root = await getRootDir();
  return root.getDirectoryHandle(modelId, { create });
}

/** Returns the OPFS FileSystemFileHandle for the final model binary. */
export async function getModelFileHandle(
  modelId: string
): Promise<FileSystemFileHandle | null> {
  try {
    const dir = await getModelDir(modelId);
    return await dir.getFileHandle('model.litertlm');
  } catch {
    return null;
  }
}

/** Returns the OPFS FileSystemFileHandle for the temporary download file. */
export async function getTmpFileHandle(
  modelId: string,
  create = false
): Promise<FileSystemFileHandle | null> {
  try {
    const dir = await getModelDir(modelId, create);
    return await dir.getFileHandle('model.tmp.litertlm', { create });
  } catch {
    return null;
  }
}

/**
 * Returns the installed model as a File (extends Blob), which is a valid
 * ModelInput for Engine.create(). Returns null if the model is not installed.
 */
export async function getInstalledModelBlob(modelId: string): Promise<File | null> {
  const handle = await getModelFileHandle(modelId);
  if (!handle) return null;
  try {
    return await handle.getFile();
  } catch {
    return null;
  }
}

/**
 * Checks whether a fully-verified model binary exists in OPFS for this modelId.
 */
export async function isModelStoredInOpfs(modelId: string): Promise<boolean> {
  const handle = await getModelFileHandle(modelId);
  if (!handle) return false;
  try {
    const f = await handle.getFile();
    return f.size > 0;
  } catch {
    return false;
  }
}

/**
 * Atomically promotes the temporary download file to the final model file.
 * This is called only after the checksum is verified.
 */
export async function promoteTemporaryFile(modelId: string): Promise<void> {
  const dir = await getModelDir(modelId);
  // FileSystemDirectoryHandle.move() is not available; we work around this
  // by reading the tmp file and writing it to the final handle, then deleting
  // the tmp file. This requires RAM equal to the file size, so we use the
  // rename approach via FileSystemFileHandle.move() where available.

  const tmpHandle = await dir.getFileHandle('model.tmp.litertlm');
  const finalHandle = await dir.getFileHandle('model.litertlm', { create: true });

  // Check if FileSystemFileHandle.move() is supported (Chrome 122+)
  if (typeof (tmpHandle as unknown as { move?: unknown }).move === 'function') {
    // Native rename: atomic and zero-copy
    await (tmpHandle as unknown as { move: (target: FileSystemDirectoryHandle, name: string) => Promise<void> }).move(dir, 'model.litertlm');
  } else {
    // Fallback: stream-copy tmp → final, then delete tmp
    const tmpFile = await tmpHandle.getFile();
    const writable = await finalHandle.createWritable();
    await tmpFile.stream().pipeTo(writable);
    await dir.removeEntry('model.tmp.litertlm');
  }
}

/**
 * Removes a model's directory and all files from OPFS.
 * Returns the number of bytes that were freed (best-effort; 0 if unknown).
 */
export async function deleteModelFromOpfs(modelId: string): Promise<number> {
  let freedBytes = 0;
  try {
    // Measure size before deletion
    const handle = await getModelFileHandle(modelId);
    if (handle) {
      try {
        const f = await handle.getFile();
        freedBytes = f.size;
      } catch {
        // Size unknown
      }
    }
    const root = await getRootDir();
    await root.removeEntry(modelId, { recursive: true });
  } catch {
    // Model directory may not exist; not an error
  }
  return freedBytes;
}

/**
 * Removes the temporary file from OPFS (called on download failure or
 * cancellation).
 */
export async function cleanupTmpFile(modelId: string): Promise<void> {
  try {
    const dir = await getModelDir(modelId);
    await dir.removeEntry('model.tmp.litertlm');
  } catch {
    // Already gone or never existed
  }
}

/**
 * Returns the size in bytes of an installed model on disk (via OPFS).
 * Returns 0 if the model is not installed.
 */
export async function getInstalledModelSizeBytes(modelId: string): Promise<number> {
  try {
    const handle = await getModelFileHandle(modelId);
    if (!handle) return 0;
    const f = await handle.getFile();
    return f.size;
  } catch {
    return 0;
  }
}

/**
 * Sums up the size of all model directories in OPFS to report accurate
 * storage consumption.
 */
export async function getTotalModelStorageBytes(): Promise<number> {
  try {
    const root = await getRootDir();
    let total = 0;
    for await (const [, dirHandle] of root as unknown as AsyncIterable<[string, FileSystemDirectoryHandle]>) {
      if (dirHandle.kind !== 'directory') continue;
      try {
        const finalHandle = await (dirHandle as FileSystemDirectoryHandle).getFileHandle('model.litertlm');
        const f = await finalHandle.getFile();
        total += f.size;
      } catch {
        // No final file in this dir
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Returns whether OPFS is available in the current browser context.
 */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

/**
 * Requests persistent storage from the browser to reduce eviction risk.
 * Returns whether the grant was given. This is advisory; OPFS is usually
 * retained even without a persistent grant.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator?.storage?.persist === 'function') {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
  return false;
}
