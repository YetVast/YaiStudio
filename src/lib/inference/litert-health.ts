/**
 * YAI Studio — 6-Layer LiteRT-LM Runtime Health Service
 *
 * Implements the rigorous 6-layer health model:
 * Layer 1 — Platform Capability: WebGPU supported / WASM fallback / Unsupported
 * Layer 2 — SDK Availability: LiteRT-LM SDK loaded / failed / uninitialized
 * Layer 3 — Runtime Initialization: Initialized / Initializing / Idle / Failed
 * Layer 4 — Model Availability: Model installed / No model installed / Corrupt
 * Layer 5 — Model Execution Readiness: Ready for inference / Loading / Unloaded / Failed
 * Layer 6 — Actual Inference: Verified / Running / Untested / Failed
 *
 * Overall status NEVER reports HEALTHY unless a verified model is installed and ready.
 */

import type { DeviceCapabilityReport, InstalledModelRecord } from './types';

export type PlatformCapabilityState = 'webgpu_supported' | 'wasm_supported' | 'unsupported';
export type SdkAvailabilityState = 'sdk_available' | 'sdk_uninitialized' | 'sdk_failed';
export type RuntimeInitState = 'runtime_initialized' | 'runtime_initializing' | 'runtime_idle' | 'runtime_failed';
export type ModelAvailabilityState = 'model_installed' | 'no_model_installed' | 'model_corrupt';
export type ModelReadinessState = 'model_ready' | 'model_loading' | 'model_unloaded' | 'model_failed';
export type InferenceExecutionState = 'inference_verified' | 'inference_running' | 'inference_untested' | 'inference_failed';

export interface LiteRTLayersHealth {
  layer1Platform: {
    state: PlatformCapabilityState;
    label: string;
    details: string;
  };
  layer2Sdk: {
    state: SdkAvailabilityState;
    label: string;
    details: string;
  };
  layer3Runtime: {
    state: RuntimeInitState;
    label: string;
    details: string;
  };
  layer4Model: {
    state: ModelAvailabilityState;
    label: string;
    details: string;
    installedModelId?: string;
  };
  layer5Readiness: {
    state: ModelReadinessState;
    label: string;
    details: string;
    loadedModelId?: string;
  };
  layer6Inference: {
    state: InferenceExecutionState;
    label: string;
    details: string;
    lastInferenceAt?: string;
    lastTokensPerSec?: number;
  };
  compositeStatus: {
    isFullyHealthy: boolean;
    headline: string;
    badgeVariant: 'success' | 'warning' | 'destructive' | 'neutral';
    summaryString: string;
  };
}

export class LiteRTHealthManager {
  /**
   * Compute the complete 6-layer health status.
   */
  static evaluateHealth(options: {
    caps: DeviceCapabilityReport | null;
    modelRecords: InstalledModelRecord[];
    activeModelId: string | null;
    loadedModelId: string | null;
    isInitializing?: boolean;
    isModelLoading?: boolean;
    isInferencing?: boolean;
    lastInferenceSuccess?: boolean;
    lastInferenceTokensPerSec?: number;
    sdkError?: string | null;
    runtimeError?: string | null;
  }): LiteRTLayersHealth {
    const {
      caps,
      modelRecords,
      activeModelId,
      loadedModelId,
      isInitializing = false,
      isModelLoading = false,
      isInferencing = false,
      lastInferenceSuccess = false,
      lastInferenceTokensPerSec,
      sdkError,
      runtimeError,
    } = options;

    // ── Layer 1: Platform Capability ──────────────────────────────────────────
    let l1State: PlatformCapabilityState = 'unsupported';
    let l1Label = 'Platform Unsupported';
    let l1Details = 'Neither WebGPU nor WebAssembly SIMD is available.';

    if (caps?.hasWebGPU) {
      l1State = 'webgpu_supported';
      l1Label = 'WebGPU Accelerated';
      l1Details = caps.gpuAdapterInfo?.vendor
        ? `${caps.gpuAdapterInfo.vendor} (${caps.gpuAdapterInfo.architecture || 'WebGPU'})`
        : 'Hardware WebGPU adapter active.';
    } else if (caps?.hasWasm) {
      l1State = 'wasm_supported';
      l1Label = 'WASM SIMD Fallback';
      l1Details = 'CPU execution via WebAssembly SIMD.';
    }

    // ── Layer 2: SDK Availability ─────────────────────────────────────────────
    let l2State: SdkAvailabilityState = 'sdk_available';
    let l2Label = 'SDK Available';
    let l2Details = '@litert-lm/core package loaded and ready.';

    if (sdkError) {
      l2State = 'sdk_failed';
      l2Label = 'SDK Failed';
      l2Details = sdkError;
    } else if (typeof window === 'undefined') {
      l2State = 'sdk_uninitialized';
      l2Label = 'SDK Standby';
      l2Details = 'Awaiting client browser environment.';
    }

    // ── Layer 3: Runtime Initialization ───────────────────────────────────────
    let l3State: RuntimeInitState = 'runtime_idle';
    let l3Label = 'Runtime Standby';
    let l3Details = 'LiteRT runtime will initialize when a model is loaded.';

    if (runtimeError) {
      l3State = 'runtime_failed';
      l3Label = 'Runtime Error';
      l3Details = runtimeError;
    } else if (isInitializing) {
      l3State = 'runtime_initializing';
      l3Label = 'Initializing Engine';
      l3Details = 'Initializing LiteRT-LM WebGPU context...';
    } else if (loadedModelId) {
      l3State = 'runtime_initialized';
      l3Label = 'Runtime Initialized';
      l3Details = 'Engine instance active in device memory.';
    }

    // ── Layer 4: Model Availability ───────────────────────────────────────────
    const installedModels = modelRecords.filter((r) => r.status === 'ready');
    const hasInstalledModel = installedModels.length > 0;
    const targetModel = activeModelId
      ? installedModels.find((r) => r.modelId === activeModelId)
      : installedModels[0];

    let l4State: ModelAvailabilityState = 'no_model_installed';
    let l4Label = 'No Model Installed';
    let l4Details = 'Download a verified model from Section 4 to begin.';

    if (hasInstalledModel && targetModel) {
      l4State = 'model_installed';
      l4Label = `${installedModels.length} Model${installedModels.length === 1 ? '' : 's'} Installed`;
      l4Details = `Active selection: ${targetModel.modelId} (${((targetModel.downloadedBytes || 0) / (1024 * 1024)).toFixed(0)} MB in OPFS).`;
    }

    // ── Layer 5: Model Execution Readiness ────────────────────────────────────
    let l5State: ModelReadinessState = 'model_unloaded';
    let l5Label = 'Model Unloaded';
    let l5Details = 'Model is stored in OPFS, awaiting allocation into WebGPU memory.';

    if (!hasInstalledModel) {
      l5State = 'model_unloaded';
      l5Label = 'Model Required';
      l5Details = 'Cannot load: no local model binary present.';
    } else if (isModelLoading) {
      l5State = 'model_loading';
      l5Label = 'Allocating Tensors';
      l5Details = 'Allocating model tensors into device memory...';
    } else if (loadedModelId) {
      l5State = 'model_ready';
      l5Label = 'Model Loaded & Ready';
      l5Details = `${loadedModelId} loaded in on-device memory, ready for inference.`;
    }

    // ── Layer 6: Actual Inference ─────────────────────────────────────────────
    let l6State: InferenceExecutionState = 'inference_untested';
    let l6Label = 'Inference Untested';
    let l6Details = 'No local generation executed in this session.';

    if (isInferencing) {
      l6State = 'inference_running';
      l6Label = 'Generating Tokens';
      l6Details = 'Executing on-device neural tensor computation...';
    } else if (lastInferenceSuccess) {
      l6State = 'inference_verified';
      l6Label = 'Inference Verified';
      l6Details = lastInferenceTokensPerSec
        ? `Successfully generated tokens at ${lastInferenceTokensPerSec} tok/s.`
        : 'Genuine local execution verified.';
    }

    // ── Composite Headline & Overall Health ────────────────────────────────────
    // Invariant: NEVER report fully healthy unless platform is supported AND a model is installed AND ready!
    let isFullyHealthy = false;
    let headline = '';
    let badgeVariant: 'success' | 'warning' | 'destructive' | 'neutral' = 'neutral';

    if (l1State === 'unsupported' || l2State === 'sdk_failed' || l3State === 'runtime_failed') {
      headline = 'Platform Incompatible or Runtime Failed';
      badgeVariant = 'destructive';
    } else if (!hasInstalledModel) {
      headline = 'WebGPU Available • No Model Installed • Inference Standby';
      badgeVariant = 'warning';
    } else if (loadedModelId && lastInferenceSuccess) {
      isFullyHealthy = true;
      headline = 'Fully Active • Model Loaded • Genuine Inference Verified';
      badgeVariant = 'success';
    } else if (loadedModelId) {
      headline = 'Model Loaded • Ready for Inference Benchmark';
      badgeVariant = 'success';
    } else {
      headline = 'Model Installed in OPFS • Unloaded (Ready to Load)';
      badgeVariant = 'neutral';
    }

    const summaryString = [
      caps?.hasWebGPU ? 'WebGPU' : 'WASM',
      l2State === 'sdk_available' ? 'SDK Ready' : 'SDK Issue',
      hasInstalledModel ? 'Model Installed' : 'No Model',
      loadedModelId ? 'Model Loaded' : 'Unloaded',
      lastInferenceSuccess ? 'Verified' : 'Untested',
    ].join(' | ');

    return {
      layer1Platform: { state: l1State, label: l1Label, details: l1Details },
      layer2Sdk: { state: l2State, label: l2Label, details: l2Details },
      layer3Runtime: { state: l3State, label: l3Label, details: l3Details },
      layer4Model: { state: l4State, label: l4Label, details: l4Details, installedModelId: targetModel?.modelId },
      layer5Readiness: { state: l5State, label: l5Label, details: l5Details, loadedModelId: loadedModelId ?? undefined },
      layer6Inference: {
        state: l6State,
        label: l6Label,
        details: l6Details,
        lastTokensPerSec: lastInferenceTokensPerSec,
      },
      compositeStatus: {
        isFullyHealthy,
        headline,
        badgeVariant,
        summaryString,
      },
    };
  }
}
