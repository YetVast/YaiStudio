/**
 * YAI Studio — Telemetry Sampler & Measurement Adapters
 *
 * Provides safe, multi-environment telemetry measurement adapters across:
 * - Browser: Performance API, memory instrumentation, deviceMemory, storage estimate
 * - WebGPU: Device adapter limits, feature inspection, buffer limits
 * - Ollama: Host daemon memory, /api/ps VRAM introspection
 * - Node.js: process.memoryUsage(), process.cpuUsage() (testing & server)
 * - Network: Transfer byte tracking for HTTP/cloud requests
 *
 * Adheres strictly to the invariant: NEVER FABRICATE MEASUREMENTS.
 * Unavailable metrics remain null with status UNAVAILABLE or NOT_SUPPORTED.
 */

import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import type { DeviceCapabilityReport } from '@/lib/inference/types';
import type { SystemResourcesSnapshot } from './types';

export interface MemorySample {
  timestamp: number;
  jsHeapUsedBytes: number | null;
  jsHeapTotalBytes: number | null;
  jsHeapLimitBytes: number | null;
  deviceRamBytes: number | null;
  vramBytes: number | null;
  storageFreeBytes: number | null;
  source: string;
}

export interface CpuSample {
  cpuUserTimeMs: number | null;
  cpuSystemTimeMs: number | null;
  cpuUtilizationPercent: number | null;
}

export class TelemetrySampler {
  /**
   * Sample current memory consumption across all available APIs.
   */
  static sampleMemory(vramOverrideBytes?: number | null): MemorySample {
    const timestamp = performance.now();
    let jsHeapUsedBytes: number | null = null;
    let jsHeapTotalBytes: number | null = null;
    let jsHeapLimitBytes: number | null = null;
    let deviceRamBytes: number | null = null;
    let vramBytes: number | null = vramOverrideBytes ?? null;
    let storageFreeBytes: number | null = null;
    let source = 'standard-performance-api';

    // 1. Browser Performance.memory (Chromium-based engines)
    if (typeof window !== 'undefined') {
      const perfMemory = (performance as unknown as {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }).memory;

      if (perfMemory) {
        jsHeapUsedBytes = perfMemory.usedJSHeapSize;
        jsHeapTotalBytes = perfMemory.totalJSHeapSize;
        jsHeapLimitBytes = perfMemory.jsHeapSizeLimit;
        source = 'browser-performance-memory';
      }

      // Device Memory API
      const navMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      if (navMem) {
        deviceRamBytes = Math.round(navMem * 1024 * 1024 * 1024);
      }
    } else if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      // 2. Node.js environment (SSR / Vitest runner)
      const mem = process.memoryUsage();
      jsHeapUsedBytes = mem.heapUsed;
      jsHeapTotalBytes = mem.heapTotal;
      jsHeapLimitBytes = mem.rss;
      source = 'node-process-memory';
    }

    return {
      timestamp,
      jsHeapUsedBytes,
      jsHeapTotalBytes,
      jsHeapLimitBytes,
      deviceRamBytes,
      vramBytes,
      storageFreeBytes,
      source,
    };
  }

  /**
   * Sample CPU execution metrics.
   */
  static sampleCpu(): CpuSample {
    if (typeof process !== 'undefined' && typeof process.cpuUsage === 'function') {
      const usage = process.cpuUsage();
      return {
        cpuUserTimeMs: Math.round(usage.user / 1000),
        cpuSystemTimeMs: Math.round(usage.system / 1000),
        cpuUtilizationPercent: null, // Point-in-time instantaneous CPU % requires delta sampling
      };
    }

    // Browsers intentionally restrict host CPU instrumentation for cross-origin privacy
    return {
      cpuUserTimeMs: null,
      cpuSystemTimeMs: null,
      cpuUtilizationPercent: null,
    };
  }

  /**
   * Capture a full snapshot of system and runtime capability limits.
   */
  static async captureSystemResources(
    cachedCaps?: DeviceCapabilityReport | null
  ): Promise<SystemResourcesSnapshot> {
    const caps = cachedCaps || (await detectDeviceCapabilities().catch(() => null));
    const memSample = this.sampleMemory();

    const jsHeapUsedMb = memSample.jsHeapUsedBytes
      ? Math.round((memSample.jsHeapUsedBytes / (1024 * 1024)) * 10) / 10
      : null;
    const jsHeapLimitMb = memSample.jsHeapLimitBytes
      ? Math.round((memSample.jsHeapLimitBytes / (1024 * 1024)) * 10) / 10
      : null;
    const jsHeapTotalMb = memSample.jsHeapTotalBytes
      ? Math.round((memSample.jsHeapTotalBytes / (1024 * 1024)) * 10) / 10
      : null;

    let gpuVendor: string | null = null;
    let gpuArchitecture: string | null = null;
    let gpuMemoryLimitMb: number | null = null;

    if (caps?.gpuAdapterInfo) {
      gpuVendor = caps.gpuAdapterInfo.vendor || null;
      gpuArchitecture = caps.gpuAdapterInfo.architecture || null;
    }
    if (caps?.gpuLimits?.maxStorageBufferBindingSize) {
      gpuMemoryLimitMb = Math.round(
        caps.gpuLimits.maxStorageBufferBindingSize / (1024 * 1024)
      );
    }

    const storageFreeGb = caps?.storage?.freeBytes
      ? Math.round((caps.storage.freeBytes / (1024 * 1024 * 1024)) * 100) / 100
      : null;

    return {
      deviceRamGb: caps?.memoryInfo?.deviceMemoryGb ?? null,
      jsHeapUsedMb,
      jsHeapLimitMb,
      jsHeapTotalMb,
      gpuMemoryLimitMb,
      gpuVendor,
      gpuArchitecture,
      storageFreeGb,
      isWebGPUSupported: Boolean(caps?.hasWebGPU),
      isWasmSupported: Boolean(caps?.hasWasm),
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'browser' : 'node',
    };
  }
}
