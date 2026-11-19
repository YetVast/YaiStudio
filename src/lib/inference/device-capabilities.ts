/**
 * YAI Studio V1 — Device Capabilities & WebGPU Detector
 *
 * Verifies whether the browser environment supports local on-device LiteRT-LM inference:
 * - WebGPU support & GPU adapter inspection
 * - WebAssembly with SIMD
 * - Origin Private File System (OPFS) for persistent model storage
 * - Storage quota headroom
 */

import type { DeviceCapabilityReport } from './types';

export async function detectDeviceCapabilities(): Promise<DeviceCapabilityReport> {
  const unsupportedReasons: string[] = [];
  let hasWebGPU = false;
  let hasWasm = false;
  let hasOpfs = false;
  let gpuAdapterInfo: DeviceCapabilityReport['gpuAdapterInfo'] = undefined;

  // 1. WebAssembly Support Check
  if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function') {
    hasWasm = true;
  } else {
    unsupportedReasons.push('WebAssembly is not available in this browser.');
  }

  // 2. WebGPU Capability Probing
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }) : null;
  if (nav && nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        // In modern Chrome/Edge, adapter.info is available
        const info = (adapter as unknown as { info?: { vendor?: string; architecture?: string; description?: string } }).info;
        if (info) {
          gpuAdapterInfo = {
            vendor: info.vendor,
            architecture: info.architecture,
            description: info.description,
          };
        }
      } else {
        unsupportedReasons.push('WebGPU is present in browser, but no compatible GPU adapter was found.');
      }
    } catch (err) {
      unsupportedReasons.push(`WebGPU initialization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    unsupportedReasons.push('WebGPU API is not supported in this browser. Please use a modern WebGPU-enabled browser (Chrome, Edge, or Firefox Nightly).');
  }

  // 3. Origin Private File System (OPFS) Check
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
    try {
      await navigator.storage.getDirectory();
      hasOpfs = true;
    } catch {
      unsupportedReasons.push('Origin Private File System (OPFS) is restricted or unavailable.');
    }
  } else {
    unsupportedReasons.push('Origin Private File System (OPFS) is not supported.');
  }

  // 4. Storage Quota Estimation
  let usageBytes = 0;
  let quotaBytes = 0;
  let freeBytes = 0;
  let usagePercent = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
      freeBytes = Math.max(0, quotaBytes - usageBytes);
      usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;

      // Recommended minimum 2.5 GB free for Gemma 2B model download & unpack
      const MIN_FREE_BYTES = 2.5 * 1024 * 1024 * 1024;
      if (freeBytes < MIN_FREE_BYTES && quotaBytes > 0) {
        unsupportedReasons.push(`Insufficient disk quota for local model weights (Free: ${(freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB, Recommended: 2.50 GB).`);
      }
    } catch {
      // Ignore quota estimation failure
    }
  }

  const isSupported = hasWebGPU && hasWasm && hasOpfs && unsupportedReasons.length === 0;

  return {
    hasWebGPU,
    hasWasm,
    hasOpfs,
    gpuAdapterInfo,
    storage: {
      usageBytes,
      quotaBytes,
      freeBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
    },
    isSupported,
    unsupportedReasons,
  };
}
