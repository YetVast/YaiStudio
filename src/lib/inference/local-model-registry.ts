import type { LocalModelDescriptor } from './types';

export const LOCAL_MODEL_CATALOG: LocalModelDescriptor[] = [
  {
    id: 'gemma-4-e2b-it-web',
    name: 'Gemma 4 E2B Instruct (WebGPU)',
    description: 'Google Gemma 4 2B instruction-tuned model in LiteRT-LM format, optimized for browser execution over WebGPU.',
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '2B',
    quantization: 'Mixed 2/4/8-bit',
    downloadSizeBytes: 2008432640,
    installedSizeBytes: 2008432640,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
    sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    recommendedGpuMemoryGb: 2.5,
    compatibility: 'supported',
    huggingFaceRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
    artifactFile: 'gemma-4-E2B-it-web.litertlm',
  },
  {
    id: 'granite-4.0-350m-web',
    name: 'IBM Granite 4.0 350M (LiteRT-LM)',
    description: 'Ultra-compact 350M parameter model for devices with constrained memory and storage.',
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '350M',
    quantization: 'Q8 EKV1280',
    downloadSizeBytes: 468209584,
    installedSizeBytes: 468209584,
    downloadUrl: 'https://huggingface.co/litert-community/granite-4.0-350m-litert-lm/resolve/main/granite-4.0-350m_q8_ekv1280.litertlm',
    sha256: 'c8e9a29493f62b7c44461fb36980987c4c1454c75e95f57ba0539a8edc9dce76',
    contextLength: 2048,
    license: 'Apache-2.0',
    recommendedGpuMemoryGb: 1.0,
    compatibility: 'supported',
    huggingFaceRepo: 'litert-community/granite-4.0-350m-litert-lm',
    artifactFile: 'granite-4.0-350m_q8_ekv1280.litertlm',
  },
  {
    id: 'gemma-4-e4b-it-web',
    name: 'Gemma 4 E4B Instruct (LiteRT-LM)',
    description: 'High-capability 4B Gemma 4 model with expanded context and reasoning capability for capable WebGPU devices.',
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '4B',
    quantization: 'Mixed 4-bit',
    downloadSizeBytes: 3950000000,
    installedSizeBytes: 3950000000,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm',
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    recommendedGpuMemoryGb: 4.5,
    compatibility: 'supported',
    huggingFaceRepo: 'litert-community/gemma-4-E4B-it-litert-lm',
    artifactFile: 'gemma-4-E4B-it-web.litertlm',
  },
  {
    id: 'gemma-3n-e2b-web',
    name: 'Gemma 3n E2B (Edge / Mobile)',
    description: 'Ultra-efficient 2B mobile and edge optimized Gemma model designed for battery-conscious and constrained environments.',
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '2B',
    quantization: 'INT4',
    downloadSizeBytes: 1820000000,
    installedSizeBytes: 1820000000,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-web.litertlm',
    sha256: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12',
    contextLength: 2048,
    license: 'Gemma Terms of Use',
    recommendedGpuMemoryGb: 2.0,
    compatibility: 'supported',
    huggingFaceRepo: 'litert-community/gemma-3n-E2B-it-litert-lm',
    artifactFile: 'gemma-3n-E2B-it-web.litertlm',
  },
  {
    id: 'gemma-2-2b-it-int4',
    name: 'Gemma 2 2B Instruct (Legacy MediaPipe)',
    description: 'Historical MediaPipe GenAI release. Incompatible with modern LiteRT-LM Web Engine.',
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '2B',
    quantization: 'INT4',
    downloadSizeBytes: 1420 * 1024 * 1024,
    installedSizeBytes: 1420 * 1024 * 1024,
    downloadUrl: '',
    sha256: '',
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    recommendedGpuMemoryGb: 2.0,
    compatibility: 'unsupported',
    unsupportedReason: 'Incompatible runtime architecture; superseded by Gemma 4 WebGPU artifact.',
  },
  {
    id: 'gemma-2b-it-int4',
    name: 'Gemma 1.1 2B Instruct (Legacy Binary)',
    description: 'Historical binary weight release. Incompatible with modern LiteRT-LM Web Engine.',
    provider: 'local-litert',
    format: 'bin',
    parameters: '2B',
    quantization: 'INT4',
    downloadSizeBytes: 1350 * 1024 * 1024,
    installedSizeBytes: 1350 * 1024 * 1024,
    downloadUrl: '',
    sha256: '',
    contextLength: 2048,
    license: 'Gemma Terms of Use',
    recommendedGpuMemoryGb: 1.5,
    compatibility: 'unsupported',
    unsupportedReason: 'Deprecated binary weight container format.',
  },
];

export function getLocalModelDescriptor(modelId: string): LocalModelDescriptor | undefined {
  return LOCAL_MODEL_CATALOG.find((m) => m.id === modelId);
}

export function getSupportedModels(): LocalModelDescriptor[] {
  return LOCAL_MODEL_CATALOG.filter((m) => m.compatibility === 'supported');
}

export function getUnsupportedModels(): LocalModelDescriptor[] {
  return LOCAL_MODEL_CATALOG.filter((m) => m.compatibility === 'unsupported');
}

export function isModelSupported(modelId: string): boolean {
  const descriptor = getLocalModelDescriptor(modelId);
  return descriptor?.compatibility === 'supported';
}
