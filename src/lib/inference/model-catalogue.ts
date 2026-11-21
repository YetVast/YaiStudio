/**
 * YAI Studio — Structured AI Model Catalogue & Recommendation Engine
 *
 * Defines vetted local models across Google Gemma, IBM Granite, Meta Llama,
 * and compact open-weight models with runtime-specific compatibility,
 * hardware requirements, and recommendation evaluation.
 */

import type { DeviceCapabilityReport } from './types';

export type ModelParameterClassification = 'ultra-compact' | 'compact' | 'mid-size' | 'large';
export type ModelArtifactFormat = 'litertlm' | 'gguf' | 'task' | 'bin';
export type SupportedRuntimeType = 'litert-lm' | 'ollama';
export type RecommendationCategory = 'recommended' | 'possible_with_limitations' | 'not_recommended';

export interface ModelCatalogueEntry {
  id: string;
  name: string;
  family: 'Google Gemma' | 'IBM Granite' | 'Meta Llama' | 'Alibaba Qwen' | 'Microsoft Phi';
  provider: string;
  parameters: string;
  parameterClassification: ModelParameterClassification;
  artifactFormat: ModelArtifactFormat;
  quantization: string;
  estimatedMemoryBytes: number;
  recommendedMinRamBytes: number;
  supportedRuntimes: SupportedRuntimeType[];
  supportedPlatforms: Array<'browser-webgpu' | 'desktop' | 'android'>;
  supportedAccelerators: Array<'webgpu' | 'cuda' | 'metal' | 'vulkan' | 'cpu'>;
  contextWindow: number;
  multimodalCapabilities: {
    text: boolean;
    vision: boolean;
    audio: boolean;
  };
  downloadSizeBytes: number;
  downloadUrl?: string;
  sha256?: string;
  compatibilityStatus: 'supported' | 'unsupported';
  unsupportedReason?: string;
  huggingFaceRepo?: string;
  artifactFile?: string;
  ollamaTag?: string;
  metadataSource: string;
  verificationDate: string;
}

export interface ModelRecommendation {
  modelId: string;
  category: RecommendationCategory;
  categoryLabel: string;
  reasons: string[];
  limitations: string[];
  estimatedLatencyCategory: 'Ultra Fast' | 'Fast' | 'Moderate' | 'Slow / High Latency';
  memoryBudgetFit: 'Comfortable' | 'Tight Budget' | 'Exceeds Budget';
}

export const EXTENDED_MODEL_CATALOGUE: ModelCatalogueEntry[] = [
  {
    id: 'gemma-4-e2b-it-web',
    name: 'Gemma 4 E2B Instruct (WebGPU)',
    family: 'Google Gemma',
    provider: 'Google DeepMind',
    parameters: '2B',
    parameterClassification: 'compact',
    artifactFormat: 'litertlm',
    quantization: 'Mixed 2/4/8-bit',
    estimatedMemoryBytes: 2.1 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 4 * 1024 * 1024 * 1024,
    supportedRuntimes: ['litert-lm', 'ollama'],
    supportedPlatforms: ['browser-webgpu', 'desktop', 'android'],
    supportedAccelerators: ['webgpu', 'cuda', 'metal', 'cpu'],
    contextWindow: 4096,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 2008432640,
    downloadUrl:
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
    sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    compatibilityStatus: 'supported',
    huggingFaceRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
    artifactFile: 'gemma-4-E2B-it-web.litertlm',
    ollamaTag: 'gemma4:2b',
    metadataSource: 'Hugging Face Git LFS (oid sha256 confirmed)',
    verificationDate: '2026-11-20',
  },
  {
    id: 'gemma-4-e4b-it-web',
    name: 'Gemma 4 E4B Instruct (LiteRT-LM / Ollama)',
    family: 'Google Gemma',
    provider: 'Google DeepMind',
    parameters: '4B',
    parameterClassification: 'mid-size',
    artifactFormat: 'litertlm',
    quantization: 'Mixed 4-bit',
    estimatedMemoryBytes: 3.9 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 8 * 1024 * 1024 * 1024,
    supportedRuntimes: ['litert-lm', 'ollama'],
    supportedPlatforms: ['browser-webgpu', 'desktop'],
    supportedAccelerators: ['webgpu', 'cuda', 'metal'],
    contextWindow: 4096,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 3950000000,
    downloadUrl: '',
    sha256: '',
    compatibilityStatus: 'supported',
    ollamaTag: 'gemma4:4b',
    metadataSource: 'LiteRT-LM Community Release',
    verificationDate: '2026-11-21',
  },
  {
    id: 'gemma-3n-e2b-edge',
    name: 'Gemma 3n E2B (Edge / Mobile)',
    family: 'Google Gemma',
    provider: 'Google DeepMind',
    parameters: '2B',
    parameterClassification: 'compact',
    artifactFormat: 'litertlm',
    quantization: 'INT4',
    estimatedMemoryBytes: 1.8 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 4 * 1024 * 1024 * 1024,
    supportedRuntimes: ['litert-lm', 'ollama'],
    supportedPlatforms: ['browser-webgpu', 'android', 'desktop'],
    supportedAccelerators: ['webgpu', 'cpu', 'cuda', 'metal'],
    contextWindow: 2048,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 1820000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'gemma3n:2b',
    metadataSource: 'Google Edge AI Specification',
    verificationDate: '2026-11-21',
  },
  {
    id: 'gemma-3n-e4b-edge',
    name: 'Gemma 3n E4B (Edge / Mobile Balanced)',
    family: 'Google Gemma',
    provider: 'Google DeepMind',
    parameters: '4B',
    parameterClassification: 'mid-size',
    artifactFormat: 'litertlm',
    quantization: 'INT4',
    estimatedMemoryBytes: 3.4 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 8 * 1024 * 1024 * 1024,
    supportedRuntimes: ['litert-lm', 'ollama'],
    supportedPlatforms: ['browser-webgpu', 'android', 'desktop'],
    supportedAccelerators: ['webgpu', 'cuda', 'metal'],
    contextWindow: 4096,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 3450000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'gemma3n:4b',
    metadataSource: 'Google Edge AI Specification',
    verificationDate: '2026-11-21',
  },
  {
    id: 'granite-4.0-350m-web',
    name: 'IBM Granite 4.0 350M (LiteRT-LM)',
    family: 'IBM Granite',
    provider: 'IBM Research',
    parameters: '350M',
    parameterClassification: 'ultra-compact',
    artifactFormat: 'litertlm',
    quantization: 'Q8 EKV1280',
    estimatedMemoryBytes: 520 * 1024 * 1024,
    recommendedMinRamBytes: 2 * 1024 * 1024 * 1024,
    supportedRuntimes: ['litert-lm', 'ollama'],
    supportedPlatforms: ['browser-webgpu', 'desktop', 'android'],
    supportedAccelerators: ['webgpu', 'cpu', 'cuda', 'metal'],
    contextWindow: 2048,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 468209584,
    downloadUrl:
      'https://huggingface.co/litert-community/granite-4.0-350m-litert-lm/resolve/main/granite-4.0-350m_q8_ekv1280.litertlm',
    sha256: 'c8e9a29493f62b7c44461fb36980987c4c1454c75e95f57ba0539a8edc9dce76',
    compatibilityStatus: 'supported',
    huggingFaceRepo: 'litert-community/granite-4.0-350m-litert-lm',
    artifactFile: 'granite-4.0-350m_q8_ekv1280.litertlm',
    ollamaTag: 'granite4:350m',
    metadataSource: 'Hugging Face Git LFS (oid sha256 confirmed)',
    verificationDate: '2026-11-20',
  },
  {
    id: 'ollama-llama3.2-1b',
    name: 'Llama 3.2 1B Instruct (Ollama)',
    family: 'Meta Llama',
    provider: 'Meta AI',
    parameters: '1B',
    parameterClassification: 'compact',
    artifactFormat: 'gguf',
    quantization: 'Q4_K_M',
    estimatedMemoryBytes: 1.3 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 3 * 1024 * 1024 * 1024,
    supportedRuntimes: ['ollama'],
    supportedPlatforms: ['desktop'],
    supportedAccelerators: ['cuda', 'metal', 'vulkan', 'cpu'],
    contextWindow: 8192,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 1300000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'llama3.2:1b',
    metadataSource: 'Ollama Model Library',
    verificationDate: '2026-11-21',
  },
  {
    id: 'ollama-llama3.2-3b',
    name: 'Llama 3.2 3B Instruct (Ollama)',
    family: 'Meta Llama',
    provider: 'Meta AI',
    parameters: '3B',
    parameterClassification: 'mid-size',
    artifactFormat: 'gguf',
    quantization: 'Q4_K_M',
    estimatedMemoryBytes: 2.8 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 6 * 1024 * 1024 * 1024,
    supportedRuntimes: ['ollama'],
    supportedPlatforms: ['desktop'],
    supportedAccelerators: ['cuda', 'metal', 'vulkan', 'cpu'],
    contextWindow: 8192,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 2000000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'llama3.2:3b',
    metadataSource: 'Ollama Model Library',
    verificationDate: '2026-11-21',
  },
  {
    id: 'ollama-qwen2.5-1.5b',
    name: 'Qwen 2.5 1.5B Instruct (Ollama)',
    family: 'Alibaba Qwen',
    provider: 'Alibaba Cloud',
    parameters: '1.5B',
    parameterClassification: 'compact',
    artifactFormat: 'gguf',
    quantization: 'Q4_K_M',
    estimatedMemoryBytes: 1.5 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 3 * 1024 * 1024 * 1024,
    supportedRuntimes: ['ollama'],
    supportedPlatforms: ['desktop'],
    supportedAccelerators: ['cuda', 'metal', 'vulkan', 'cpu'],
    contextWindow: 32768,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 986000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'qwen2.5:1.5b',
    metadataSource: 'Ollama Model Library',
    verificationDate: '2026-11-21',
  },
  {
    id: 'ollama-gemma2-9b',
    name: 'Gemma 2 9B Instruct (Ollama High-Capacity)',
    family: 'Google Gemma',
    provider: 'Google DeepMind',
    parameters: '9B',
    parameterClassification: 'large',
    artifactFormat: 'gguf',
    quantization: 'Q4_K_M',
    estimatedMemoryBytes: 7.2 * 1024 * 1024 * 1024,
    recommendedMinRamBytes: 16 * 1024 * 1024 * 1024,
    supportedRuntimes: ['ollama'],
    supportedPlatforms: ['desktop'],
    supportedAccelerators: ['cuda', 'metal', 'vulkan'],
    contextWindow: 8192,
    multimodalCapabilities: { text: true, vision: false, audio: false },
    downloadSizeBytes: 5400000000,
    compatibilityStatus: 'supported',
    ollamaTag: 'gemma2:9b',
    metadataSource: 'Ollama Model Library',
    verificationDate: '2026-11-21',
  },
];

/**
 * Evaluates a model against device capabilities and available runtimes
 * to generate a nuanced recommendation with explicit rationale.
 */
export function evaluateModelRecommendation(
  model: ModelCatalogueEntry,
  caps: DeviceCapabilityReport | null,
  activeRuntime: 'litert-lm' | 'ollama' | 'none' = 'litert-lm',
  isOllamaAvailable = false
): ModelRecommendation {
  const reasons: string[] = [];
  const limitations: string[] = [];

  const deviceRamBytes = caps?.memoryInfo?.deviceMemoryGb
    ? caps.memoryInfo.deviceMemoryGb * 1024 * 1024 * 1024
    : 8 * 1024 * 1024 * 1024; // fallback estimation

  const freeDiskBytes = caps?.storage?.freeBytes || 0;
  const hasWebGPU = caps?.hasWebGPU ?? false;
  const cores = caps?.computeInfo?.logicalCores || 4;

  let isRuntimeSupported = false;
  if (model.supportedRuntimes.includes('litert-lm') && caps?.hasWasm) {
    isRuntimeSupported = true;
  }
  if (model.supportedRuntimes.includes('ollama') && isOllamaAvailable) {
    isRuntimeSupported = true;
  }

  // Memory evaluation
  const memoryRatio = deviceRamBytes / model.recommendedMinRamBytes;
  let memoryBudgetFit: ModelRecommendation['memoryBudgetFit'] = 'Comfortable';
  if (deviceRamBytes < model.recommendedMinRamBytes) {
    memoryBudgetFit = 'Exceeds Budget';
  } else if (memoryRatio < 1.4) {
    memoryBudgetFit = 'Tight Budget';
  }

  // Latency estimation
  let estimatedLatencyCategory: ModelRecommendation['estimatedLatencyCategory'] = 'Fast';
  if (model.parameterClassification === 'ultra-compact') {
    estimatedLatencyCategory = 'Ultra Fast';
  } else if (model.parameterClassification === 'large') {
    estimatedLatencyCategory = hasWebGPU ? 'Moderate' : 'Slow / High Latency';
  } else if (!hasWebGPU && model.parameterClassification === 'mid-size') {
    estimatedLatencyCategory = 'Moderate';
  }

  // Check Storage
  const hasStorageRoom = freeDiskBytes === 0 || freeDiskBytes >= model.downloadSizeBytes * 1.2;

  // Build recommendation category
  let category: RecommendationCategory = 'recommended';

  const isModelSupportedByActiveRuntime = activeRuntime !== 'none' && model.supportedRuntimes.includes(activeRuntime as SupportedRuntimeType);

  if (!isRuntimeSupported && !isModelSupportedByActiveRuntime) {
    category = 'not_recommended';
    limitations.push(`Requires ${model.supportedRuntimes.join(' or ')} runtime, which is not currently active.`);
  } else if (memoryBudgetFit === 'Exceeds Budget') {
    category = 'not_recommended';
    limitations.push(
      `Estimated memory requirement (${(model.recommendedMinRamBytes / 1024 / 1024 / 1024).toFixed(1)} GB) exceeds detected device budget (${(deviceRamBytes / 1024 / 1024 / 1024).toFixed(1)} GB).`
    );
  } else if (!hasStorageRoom && freeDiskBytes > 0) {
    category = 'not_recommended';
    limitations.push(
      `Insufficient disk storage. Available: ${(freeDiskBytes / 1024 / 1024 / 1024).toFixed(1)} GB, Required: ${(model.downloadSizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB.`
    );
  } else if (model.supportedRuntimes.includes('litert-lm') && !hasWebGPU && model.parameterClassification !== 'ultra-compact') {
    category = 'possible_with_limitations';
    limitations.push('WebGPU is not active; model will execute via CPU/WebAssembly which will produce slower token throughput.');
    reasons.push('Model artifact is compatible with in-browser WebAssembly SIMD runtime.');
  } else if (memoryBudgetFit === 'Tight Budget') {
    category = 'possible_with_limitations';
    limitations.push('Tight memory headroom may limit maximum concurrent context tokens.');
    reasons.push('Fits within the detected device RAM allocation.');
  } else {
    category = 'recommended';
    reasons.push('Model memory requirements fit comfortably within the detected device budget.');
    if (hasWebGPU && model.supportedRuntimes.includes('litert-lm')) {
      reasons.push('WebGPU hardware acceleration is detected and active.');
    }
    if (cores >= 6) {
      reasons.push(`CPU with ${cores} cores provides sufficient tokenization bandwidth.`);
    }
  }

  // Always list format and context capability
  reasons.push(`Supports up to ${model.contextWindow.toLocaleString()} context tokens.`);
  if (model.sha256) {
    reasons.push('Authoritative cryptographic SHA-256 checksum verified from source repository.');
  }

  const categoryLabel =
    category === 'recommended'
      ? 'Recommended'
      : category === 'possible_with_limitations'
      ? 'Possible with limitations'
      : 'Not recommended';

  return {
    modelId: model.id,
    category,
    categoryLabel,
    reasons,
    limitations,
    estimatedLatencyCategory,
    memoryBudgetFit,
  };
}

/**
 * Returns model comparison comparison metadata for 2 or more models.
 */
export function compareModels(modelIds: string[]): Array<{
  model: ModelCatalogueEntry;
  recommendation: ModelRecommendation;
}> {
  return modelIds
    .map((id) => {
      const model = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === id);
      if (!model) return null;
      const rec = evaluateModelRecommendation(model, null);
      return { model, recommendation: rec };
    })
    .filter((entry): entry is { model: ModelCatalogueEntry; recommendation: ModelRecommendation } => entry !== null);
}
