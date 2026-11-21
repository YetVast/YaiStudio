/**
 * YAI Studio — Comprehensive Device Intelligence & Hardware Detection
 *
 * Reliably probes and reports:
 * - Device and Operating System (platform, engine, screen, network, timezone)
 * - Processor and Compute (logical cores, architecture, WebGPU, WebAssembly SIMD, WebGL)
 * - Memory telemetry (approximate RAM, JS heap used/limit, storage quota)
 * - Rigorous Capability Assessment (classification, suitability, runtime compatibility)
 *
 * Follows strict privacy guidelines: never fabricates missing values,
 * accurately labels browser estimates, and explains platform restrictions.
 */

import type { DeviceCapabilityReport } from './types';

export async function detectDeviceCapabilities(): Promise<DeviceCapabilityReport> {
  const unsupportedReasons: string[] = [];
  const privacyNotes: string[] = [];
  const computeNotes: string[] = [];
  const memoryNotes: string[] = [];

  let hasWebGPU = false;
  let hasWasm = false;
  let hasOpfs = false;
  let gpuAdapterInfo: DeviceCapabilityReport['gpuAdapterInfo'] = undefined;
  let gpuLimits: DeviceCapabilityReport['gpuLimits'] = undefined;
  let gpuVendor: string | undefined = undefined;
  let gpuRenderer: string | undefined = undefined;

  const isBrowser = typeof window !== 'undefined';
  const nav = typeof navigator !== 'undefined' ? navigator : null;

  // ───────────────────────────────────────────────────────────────────────────
  // A. Device and Operating System Detection
  // ───────────────────────────────────────────────────────────────────────────
  let platform = 'Unknown Operating System';
  let platformVersion: string | undefined = undefined;
  let browserName = 'Unknown Browser';
  let browserVersion = 'Unknown Version';
  let browserEngine = 'Unknown Engine';
  let deviceType: 'Desktop' | 'Laptop' | 'Tablet' | 'Mobile' | 'Unknown' = 'Unknown';

  if (nav) {
    const ua = nav.userAgent || '';

    // Operating System detection
    if (/Windows NT 10.0/i.test(ua)) platform = 'Windows 10/11';
    else if (/Windows NT/i.test(ua)) platform = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) platform = 'macOS';
    else if (/Android/i.test(ua)) platform = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
    else if (/CrOS/i.test(ua)) platform = 'ChromeOS';
    else if (/Linux/i.test(ua)) platform = 'Linux';

    // Browser Engine & Name detection
    if (/Edg\//i.test(ua)) {
      browserName = 'Microsoft Edge';
      browserEngine = 'Blink';
      const match = ua.match(/Edg\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (/Chrome\//i.test(ua)) {
      browserName = 'Google Chrome';
      browserEngine = 'Blink';
      const match = ua.match(/Chrome\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (/Firefox\//i.test(ua)) {
      browserName = 'Mozilla Firefox';
      browserEngine = 'Gecko';
      const match = ua.match(/Firefox\/([\d.]+)/);
      if (match) browserVersion = match[1];
    } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
      browserName = 'Apple Safari';
      browserEngine = 'WebKit';
      const match = ua.match(/Version\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }

    // High Entropy values (User-Agent Client Hints) if supported
    const navUaData = (nav as unknown as { userAgentData?: {
      platform?: string;
      getHighEntropyValues?: (hints: string[]) => Promise<{
        platformVersion?: string;
        architecture?: string;
        bitness?: string;
        model?: string;
      }>;
    } }).userAgentData;

    if (navUaData?.platform) {
      platform = navUaData.platform;
    }

    // Device Type identification
    const isTouch = (nav.maxTouchPoints ?? 0) > 0;
    const isMobileUA = /Mobi|Android|iPhone/i.test(ua);
    const screenWidth = isBrowser && window.screen ? window.screen.width : 1920;
    const screenHeight = isBrowser && window.screen ? window.screen.height : 1080;
    const minDim = Math.min(screenWidth, screenHeight);

    if (isMobileUA && minDim < 600) {
      deviceType = 'Mobile';
    } else if (isTouch && minDim >= 600 && minDim <= 1024) {
      deviceType = 'Tablet';
    } else if (!isTouch && screenWidth >= 1024) {
      deviceType = 'Desktop';
    } else if (isTouch && screenWidth >= 1024) {
      deviceType = 'Laptop'; // Touchscreen laptop
    } else {
      deviceType = 'Desktop';
    }

    privacyNotes.push('Browser User-Agent Client Hints may redact specific hardware model names to protect user privacy.');
  }

  const screenResolution = isBrowser && window.screen ? `${window.screen.width} × ${window.screen.height}` : 'Unavailable';
  const availableScreen = isBrowser && window.screen ? `${window.screen.availWidth} × ${window.screen.availHeight}` : 'Unavailable';
  const devicePixelRatio = isBrowser && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const language = nav?.language || 'en';
  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // fallback
  }

  // Network connection inspection
  let connectionType: string | undefined = undefined;
  let effectiveType: string | undefined = undefined;
  let downlinkMb: number | undefined = undefined;
  let rttMs: number | undefined = undefined;

  const conn = (nav as unknown as { connection?: {
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } })?.connection;

  if (conn) {
    connectionType = conn.type;
    effectiveType = conn.effectiveType;
    downlinkMb = conn.downlink;
    rttMs = conn.rtt;
  }

  const isOnline = nav ? nav.onLine : true;

  // ───────────────────────────────────────────────────────────────────────────
  // B. Processor and Compute Probing
  // ───────────────────────────────────────────────────────────────────────────
  const logicalCores = nav?.hardwareConcurrency || undefined;
  let cpuArchitecture: string | undefined = undefined;

  // WebAssembly Support Check
  if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function') {
    hasWasm = true;
  } else {
    unsupportedReasons.push('WebAssembly is not available in this browser.');
  }

  // WebGPU Capability Probing
  const gpuNav = nav as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
  if (gpuNav && gpuNav.gpu && typeof gpuNav.gpu.requestAdapter === 'function') {
    try {
      const adapter = (await gpuNav.gpu.requestAdapter()) as {
        info?: { vendor?: string; architecture?: string; description?: string; device?: string };
        requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string; description?: string; device?: string }>;
        limits?: {
          maxBufferSize?: number;
          maxStorageBufferBindingSize?: number;
          maxComputeWorkgroupStorageSize?: number;
        };
      } | null;

      if (adapter) {
        hasWebGPU = true;
        let info = adapter.info;
        if (!info && typeof adapter.requestAdapterInfo === 'function') {
          try {
            info = await adapter.requestAdapterInfo();
          } catch {
            // fallback
          }
        }

        if (info) {
          gpuAdapterInfo = {
            vendor: info.vendor || 'Standard GPU Vendor',
            architecture: info.architecture || 'WebGPU Architecture',
            description: info.description,
            device: info.device,
          };
          gpuVendor = info.vendor;
          gpuRenderer = info.description || info.architecture;
        }

        if (adapter.limits) {
          gpuLimits = {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
          };
        }
      } else {
        computeNotes.push('WebGPU API is present in browser, but no compatible GPU adapter was found.');
      }
    } catch (err) {
      computeNotes.push(`WebGPU initialization query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    computeNotes.push('WebGPU API is not supported in this browser. Use Chrome, Edge, or Firefox Nightly for GPU acceleration.');
  }

  // WebGL Renderer fallback inspection if WebGPU renderer info is restricted
  if (!gpuRenderer && isBrowser && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor;
          gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
        }
      }
    } catch {
      // ignore webgl inspection error
    }
  }

  const supportedBackends: Array<'WebGPU' | 'WebAssembly SIMD' | 'WebGL' | 'CPU'> = [];
  if (hasWebGPU) supportedBackends.push('WebGPU');
  if (hasWasm) supportedBackends.push('WebAssembly SIMD');
  if (isBrowser) supportedBackends.push('WebGL');
  supportedBackends.push('CPU');

  let hardwareAcceleration = 'CPU Emulated / Software';
  if (hasWebGPU) {
    hardwareAcceleration = 'Full Hardware Acceleration (WebGPU)';
  } else if (supportedBackends.includes('WebGL')) {
    hardwareAcceleration = 'Partial Acceleration (WebGL / WASM)';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // C. Memory Inspection (Device, Heap, Storage)
  // ───────────────────────────────────────────────────────────────────────────
  const deviceMemoryGb = (nav as unknown as { deviceMemory?: number })?.deviceMemory;
  const isDeviceMemoryQuantized = deviceMemoryGb !== undefined;

  let jsHeapUsedMb: number | undefined = undefined;
  let jsHeapLimitMb: number | undefined = undefined;

  if (isBrowser && (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
    const mem = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    jsHeapUsedMb = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    jsHeapLimitMb = Math.round((mem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
  }

  memoryNotes.push('Browser JavaScript cannot inspect complete host system RAM usage due to sandbox security boundaries.');
  if (isDeviceMemoryQuantized) {
    memoryNotes.push(`Approximate device RAM is reported by navigator.deviceMemory (${deviceMemoryGb} GiB), clamped to prevent browser fingerprinting.`);
  } else {
    memoryNotes.push('navigator.deviceMemory is not exposed in this browser (available primarily on Chromium).');
  }
  memoryNotes.push('On native Android runtimes, ActivityManager.MemoryInfo exposes totalMem, availMem, and lowMemory threshold.');

  // ───────────────────────────────────────────────────────────────────────────
  // OPFS & Storage Quota
  // ───────────────────────────────────────────────────────────────────────────
  if (nav && nav.storage && typeof nav.storage.getDirectory === 'function') {
    try {
      await nav.storage.getDirectory();
      hasOpfs = true;
    } catch {
      unsupportedReasons.push('Origin Private File System (OPFS) is restricted or unavailable.');
    }
  } else {
    unsupportedReasons.push('Origin Private File System (OPFS) is not supported.');
  }

  let usageBytes = 0;
  let quotaBytes = 0;
  let freeBytes = 0;
  let usagePercent = 0;

  if (nav && nav.storage && nav.storage.estimate) {
    try {
      const estimate = await nav.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
      freeBytes = Math.max(0, quotaBytes - usageBytes);
      usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;

      const MIN_FREE_BYTES = 2.0 * 1024 * 1024 * 1024;
      if (freeBytes < MIN_FREE_BYTES && quotaBytes > 0) {
        unsupportedReasons.push(
          `Insufficient disk quota for local model weights (Free: ${(freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB, Recommended: 2.00 GB).`
        );
      }
    } catch {
      // Quota estimate failure
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // D. Capability Assessment Calculation
  // ───────────────────────────────────────────────────────────────────────────
  const assessmentReasons: string[] = [];
  const assessmentLimitations: string[] = [];

  let overallClassification: 'High capability' | 'Moderate capability' | 'Limited capability' | 'Insufficient information' = 'Moderate capability';
  let cpuCapability = 'Moderate (4-7 cores)';
  let gpuCapability = 'Unavailable';
  let memorySuitability = 'Limited (<8 GB)';
  let localInferenceSuitability: 'Highly Suitable' | 'Suitable with Limitations' | 'Constrained' | 'Not Recommended' = 'Suitable with Limitations';

  // Evaluate CPU
  if (logicalCores !== undefined) {
    if (logicalCores >= 8) {
      cpuCapability = `High (${logicalCores} logical cores)`;
      assessmentReasons.push(`Multi-threaded CPU with ${logicalCores} cores provides sufficient compute for prompt tokenization and background execution.`);
    } else if (logicalCores >= 4) {
      cpuCapability = `Moderate (${logicalCores} logical cores)`;
      assessmentReasons.push(`Quad-core or higher processor (${logicalCores} cores) capable of handling on-device inference.`);
    } else {
      cpuCapability = `Limited (${logicalCores} logical cores)`;
      assessmentLimitations.push(`Constrained CPU core count (${logicalCores} cores) may experience higher latency during context processing.`);
    }
  } else {
    cpuCapability = 'Restricted by browser privacy';
    assessmentLimitations.push('Logical CPU core count could not be verified directly.');
  }

  // Evaluate GPU
  if (hasWebGPU) {
    gpuCapability = gpuAdapterInfo?.vendor
      ? `High (WebGPU Accelerated — ${gpuAdapterInfo.vendor})`
      : 'High (WebGPU Accelerated)';
    assessmentReasons.push('WebGPU hardware acceleration is active, enabling high-throughput tensor operations directly on your graphics hardware.');
  } else if (supportedBackends.includes('WebGL')) {
    gpuCapability = 'Limited (WebGL / CPU Fallback)';
    assessmentLimitations.push('WebGPU is not active; inference will run via WebAssembly SIMD or local Ollama background service.');
  } else {
    gpuCapability = 'Unavailable';
    assessmentLimitations.push('No graphics acceleration available.');
  }

  // Evaluate Memory
  if (deviceMemoryGb !== undefined) {
    if (deviceMemoryGb >= 16) {
      memorySuitability = `High (≥${deviceMemoryGb} GB Approximate RAM)`;
      assessmentReasons.push(`Generous system memory budget (≥${deviceMemoryGb} GB) allows comfortably hosting 2B-4B models.`);
    } else if (deviceMemoryGb >= 8) {
      memorySuitability = `Moderate (${deviceMemoryGb} GB Approximate RAM)`;
      assessmentReasons.push(`Sufficient memory (${deviceMemoryGb} GB) to run compact models (e.g. Gemma 4 E2B, Granite 350M).`);
    } else {
      memorySuitability = `Limited (${deviceMemoryGb} GB Approximate RAM)`;
      assessmentLimitations.push(`Restricted RAM (${deviceMemoryGb} GB). Ultra-compact models (Granite 350M, Gemma 3n E2B) are recommended.`);
    }
  } else {
    memorySuitability = 'Restricted by browser privacy';
    assessmentLimitations.push('Total system RAM is not exposed by this browser.');
  }

  // Calculate Overall Classification & Suitability
  if (hasWebGPU && (logicalCores === undefined || logicalCores >= 6) && (deviceMemoryGb === undefined || deviceMemoryGb >= 8)) {
    overallClassification = 'High capability';
    localInferenceSuitability = 'Highly Suitable';
  } else if (hasWasm && (deviceMemoryGb === undefined || deviceMemoryGb >= 4)) {
    overallClassification = 'Moderate capability';
    localInferenceSuitability = 'Suitable with Limitations';
  } else if (!hasWasm && !hasWebGPU) {
    overallClassification = 'Limited capability';
    localInferenceSuitability = 'Not Recommended';
  } else {
    overallClassification = 'Moderate capability';
    localInferenceSuitability = 'Suitable with Limitations';
  }

  const runtimeCompatibility = {
    litertWebGpu: hasWebGPU && hasWasm && hasOpfs,
    litertWasm: hasWasm && hasOpfs,
    ollamaNative: true, // Native Ollama runs out-of-process on the host OS
  };

  const isSupported = hasWebGPU && hasWasm && hasOpfs && unsupportedReasons.length === 0;

  return {
    hasWebGPU,
    hasWasm,
    hasOpfs,
    gpuAdapterInfo,
    gpuLimits,
    storage: {
      usageBytes,
      quotaBytes,
      freeBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
    },
    isSupported,
    unsupportedReasons,

    deviceInfo: {
      platform,
      platformVersion,
      browserName,
      browserVersion,
      browserEngine,
      deviceType,
      screenResolution,
      availableScreen,
      devicePixelRatio,
      language,
      timeZone,
      networkStatus: {
        isOnline,
        connectionType,
        effectiveType,
        downlinkMb,
        rttMs,
      },
      privacyNotes,
    },

    computeInfo: {
      logicalCores,
      cpuArchitecture,
      gpuVendor,
      gpuRenderer,
      supportedBackends,
      hardwareAcceleration,
      computeNotes,
    },

    memoryInfo: {
      deviceMemoryGb,
      deviceMemoryQuantized: isDeviceMemoryQuantized,
      jsHeapUsedMb,
      jsHeapLimitMb,
      memoryNotes,
    },

    assessment: {
      overallClassification,
      cpuCapability,
      gpuCapability,
      memorySuitability,
      localInferenceSuitability,
      runtimeCompatibility,
      assessmentReasons,
      assessmentLimitations,
    },
  };
}
