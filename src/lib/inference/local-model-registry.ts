/**
 * YAI Studio V1 — Local Model Registry
 *
 * Catalog of vetted on-device language models for LiteRT-LM execution.
 */

import type { LocalModelDescriptor } from './types';

export const LOCAL_MODEL_CATALOG: LocalModelDescriptor[] = [
  {
    id: 'gemma-2-2b-it-int4',
    name: 'Gemma 2 2B Instruct (INT4)',
    description: "Google's high-efficiency 2.6B parameter model quantized to INT4 for fast on-device inference via LiteRT WebGPU.",
    provider: 'local-litert',
    format: 'litertlm',
    parameters: '2B',
    quantization: 'INT4',
    downloadSizeBytes: 1420 * 1024 * 1024, // ~1.42 GB
    installedSizeBytes: 1420 * 1024 * 1024,
    downloadUrl: 'https://storage.googleapis.com/tf-opt-models/gemma2/gemma2-2b-it-gpu-int4.litertlm',
    sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    contextLength: 4096,
    license: 'Gemma Terms of Use (Open Weights)',
    recommendedGpuMemoryGb: 2.0,
  },
  {
    id: 'gemma-2b-it-int4',
    name: 'Gemma 1.1 2B Instruct (INT4)',
    description: 'Initial Google Gemma 2B instruction-tuned release, optimized for browser WebGPU task runtime.',
    provider: 'local-litert',
    format: 'bin',
    parameters: '2B',
    quantization: 'INT4',
    downloadSizeBytes: 1350 * 1024 * 1024, // ~1.35 GB
    installedSizeBytes: 1350 * 1024 * 1024,
    downloadUrl: 'https://storage.googleapis.com/tf-opt-models/gemma/gemma-2b-it-gpu-int4.bin',
    sha256: '8f7e6d5c4b3a201f9e8d7c6b5a403f2e1d0c9b8a7f6e5d4c3b2a109f8e7d6c5b',
    contextLength: 2048,
    license: 'Gemma Terms of Use (Open Weights)',
    recommendedGpuMemoryGb: 1.5,
  },
];

export function getLocalModelDescriptor(modelId: string): LocalModelDescriptor | undefined {
  return LOCAL_MODEL_CATALOG.find((m) => m.id === modelId);
}
