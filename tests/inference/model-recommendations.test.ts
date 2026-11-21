import { describe, it, expect } from 'vitest';
import {
  EXTENDED_MODEL_CATALOGUE,
  evaluateModelRecommendation,
  compareModels,
} from '@/lib/inference/model-catalogue';
import type { DeviceCapabilityReport } from '@/lib/inference/types';

describe('AI Model Recommendation Engine & Catalogue', () => {
  const highEndDeviceCaps: DeviceCapabilityReport = {
    hasWebGPU: true,
    hasWasm: true,
    hasOpfs: true,
    isSupported: true,
    unsupportedReasons: [],
    storage: {
      quotaBytes: 100 * 1024 * 1024 * 1024,
      usageBytes: 10 * 1024 * 1024 * 1024,
      freeBytes: 90 * 1024 * 1024 * 1024,
      usagePercent: 10,
    },
    computeInfo: {
      logicalCores: 8,
      supportedBackends: ['WebGPU', 'WebAssembly SIMD', 'CPU'],
      hardwareAcceleration: 'Full Hardware Acceleration (WebGPU)',
      computeNotes: [],
    },
    memoryInfo: {
      deviceMemoryGb: 16,
      deviceMemoryQuantized: true,
      jsHeapUsedMb: 60,
      jsHeapLimitMb: 4096,
      memoryNotes: [],
    },
    assessment: {
      overallClassification: 'High capability',
      cpuCapability: 'High (8 logical cores)',
      gpuCapability: 'High (WebGPU Accelerated)',
      memorySuitability: 'High (≥16 GB Approximate RAM)',
      localInferenceSuitability: 'Highly Suitable',
      runtimeCompatibility: {
        litertWebGpu: true,
        litertWasm: true,
        ollamaNative: true,
      },
      assessmentReasons: [],
      assessmentLimitations: [],
    },
  };

  const lowEndDeviceCaps: DeviceCapabilityReport = {
    hasWebGPU: false,
    hasWasm: true,
    hasOpfs: true,
    isSupported: false,
    unsupportedReasons: ['WebGPU not available'],
    storage: {
      quotaBytes: 5 * 1024 * 1024 * 1024,
      usageBytes: 2 * 1024 * 1024 * 1024,
      freeBytes: 3 * 1024 * 1024 * 1024,
      usagePercent: 40,
    },
    computeInfo: {
      logicalCores: 2,
      supportedBackends: ['WebAssembly SIMD', 'CPU'],
      hardwareAcceleration: 'CPU Emulated / Software',
      computeNotes: [],
    },
    memoryInfo: {
      deviceMemoryGb: 2,
      deviceMemoryQuantized: true,
      memoryNotes: [],
    },
    assessment: {
      overallClassification: 'Limited capability',
      cpuCapability: 'Limited (2 logical cores)',
      gpuCapability: 'Unavailable',
      memorySuitability: 'Limited (<8 GB)',
      localInferenceSuitability: 'Constrained',
      runtimeCompatibility: {
        litertWebGpu: false,
        litertWasm: true,
        ollamaNative: false,
      },
      assessmentReasons: [],
      assessmentLimitations: [],
    },
  };

  it('contains structured entries for Gemma, Granite, Llama, and Qwen families', () => {
    expect(EXTENDED_MODEL_CATALOGUE.length).toBeGreaterThanOrEqual(8);

    const gemma4 = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'gemma-4-e2b-it-web');
    expect(gemma4).toBeDefined();
    expect(gemma4?.family).toBe('Google Gemma');
    expect(gemma4?.artifactFormat).toBe('litertlm');
    expect(gemma4?.sha256).toBe('3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5');

    const granite = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'granite-4.0-350m-web');
    expect(granite).toBeDefined();
    expect(granite?.parameterClassification).toBe('ultra-compact');

    const llama = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'ollama-llama3.2-1b');
    expect(llama).toBeDefined();
    expect(llama?.family).toBe('Meta Llama');
  });

  it('classifies Gemma 4 E2B as recommended on high-end hardware with WebGPU', () => {
    const gemma4 = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'gemma-4-e2b-it-web')!;
    const rec = evaluateModelRecommendation(gemma4, highEndDeviceCaps, 'litert-lm');

    expect(rec.category).toBe('recommended');
    expect(rec.categoryLabel).toBe('Recommended');
    expect(rec.reasons.some((r) => r.includes('WebGPU'))).toBe(true);
    expect(rec.memoryBudgetFit).toBe('Comfortable');
  });

  it('classifies Gemma 4 E2B as possible_with_limitations when WebGPU is unavailable', () => {
    const cpuOnlyCaps: DeviceCapabilityReport = {
      ...highEndDeviceCaps,
      hasWebGPU: false,
    };
    const gemma4 = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'gemma-4-e2b-it-web')!;
    const rec = evaluateModelRecommendation(gemma4, cpuOnlyCaps, 'litert-lm');

    expect(rec.category).toBe('possible_with_limitations');
    expect(rec.limitations.some((l) => l.includes('WebGPU is not active'))).toBe(true);
  });

  it('classifies large models as not_recommended on resource-constrained devices', () => {
    const largeModel = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'ollama-gemma2-9b')!;
    const rec = evaluateModelRecommendation(largeModel, lowEndDeviceCaps, 'ollama', true);

    expect(rec.category).toBe('not_recommended');
    expect(rec.memoryBudgetFit).toBe('Exceeds Budget');
    expect(rec.limitations.some((l) => l.includes('exceeds detected device budget'))).toBe(true);
  });

  it('classifies compact Granite 350M as recommended or possible on low RAM devices', () => {
    const granite = EXTENDED_MODEL_CATALOGUE.find((m) => m.id === 'granite-4.0-350m-web')!;
    const rec = evaluateModelRecommendation(granite, lowEndDeviceCaps, 'litert-lm');

    expect(rec.category).not.toBe('not_recommended');
    expect(rec.estimatedLatencyCategory).toBe('Ultra Fast');
  });

  it('compares multiple models side-by-side with distinct specs and recommendations', () => {
    const comparison = compareModels(['gemma-4-e2b-it-web', 'granite-4.0-350m-web']);
    expect(comparison.length).toBe(2);
    expect(comparison[0].model.id).toBe('gemma-4-e2b-it-web');
    expect(comparison[1].model.id).toBe('granite-4.0-350m-web');
    expect(comparison[0].recommendation).toBeDefined();
    expect(comparison[1].recommendation).toBeDefined();
  });
});
