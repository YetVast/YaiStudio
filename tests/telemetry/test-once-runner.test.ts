import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  REGISTERED_COMPONENTS,
  createDefaultComponentTelemetry,
  buildInitialComponentsTelemetry,
} from '@/lib/telemetry/test-runner/registered-components';
import { TelemetrySampler } from '@/lib/telemetry/test-runner/telemetry-sampler';
import {
  TestOnceRunner,
  DEFAULT_TEST_QUERY,
} from '@/lib/telemetry/test-runner/test-runner';
import { TestHistoryStorage } from '@/lib/telemetry/test-runner/test-history-storage';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { OllamaClient } from '@/lib/inference/runtimes/ollama-client';
import type { TestOnceResult } from '@/lib/telemetry/test-runner/types';

describe('AI Runtime Memory Monitor — Test Once Telemetry', () => {
  const store: Record<string, string> = {};

  beforeEach(async () => {
    for (const k in store) {
      delete store[k];
    }

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      },
    });

    // Reset test history
    await TestHistoryStorage.clearTestHistory();
  });

  describe('1. Comprehensive Resource Accounting & Component Catalog', () => {
    it('registers all 8 architectural categories from the specification', () => {
      const categories = new Set(REGISTERED_COMPONENTS.map((c) => c.category));
      expect(categories.has('Model and Inference')).toBe(true);
      expect(categories.has('Context and Conversation')).toBe(true);
      expect(categories.has('Skills and Knowledge')).toBe(true);
      expect(categories.has('Personal Intelligence')).toBe(true);
      expect(categories.has('Agent Orchestration')).toBe(true);
      expect(categories.has('Tool and Execution')).toBe(true);
      expect(categories.has('Application & Infrastructure')).toBe(true);
      expect(categories.has('Response Resources')).toBe(true);
    });

    it('ensures all component IDs are unique and fully defined', () => {
      const ids = new Set<string>();
      for (const comp of REGISTERED_COMPONENTS) {
        expect(comp.id).toBeTruthy();
        expect(comp.name).toBeTruthy();
        expect(ids.has(comp.id)).toBe(false);
        ids.add(comp.id);
      }
      expect(ids.size).toBeGreaterThanOrEqual(40);
    });

    it('initializes NOT_USED components with zero consumption and zero duration', () => {
      const components = buildInitialComponentsTelemetry();
      expect(components.length).toBe(REGISTERED_COMPONENTS.length);

      for (const c of components) {
        expect(c.status).toBe('NOT_USED');
        expect(c.memory.allocatedBytes).toBe(0);
        expect(c.memory.residentBytes).toBe(0);
        expect(c.memory.peakBytes).toBe(0);
        expect(c.memory.incrementalBytes).toBe(0);
        expect(c.timing.durationMs).toBe(0);
        expect(c.tokens.input).toBe(0);
        expect(c.tokens.output).toBe(0);
        expect(c.compute.cpuTimeMs).toBe(0);
      }
    });

    it('preserves null for UNAVAILABLE and NOT_SUPPORTED components rather than fabricating zero', () => {
      const mockMeta = REGISTERED_COMPONENTS[0]; // model_loading
      const unavailableComp = createDefaultComponentTelemetry(mockMeta, 'UNAVAILABLE');

      expect(unavailableComp.status).toBe('UNAVAILABLE');
      expect(unavailableComp.memory.allocatedBytes).toBeNull();
      expect(unavailableComp.memory.residentBytes).toBeNull();
      expect(unavailableComp.compute.gpuMemoryBytes).toBeNull();
      expect(unavailableComp.tokens.input).toBeNull();
      expect(unavailableComp.timing.durationMs).toBeNull();

      const notSupportedComp = createDefaultComponentTelemetry(mockMeta, 'NOT_SUPPORTED');
      expect(notSupportedComp.status).toBe('NOT_SUPPORTED');
      expect(notSupportedComp.memory.peakBytes).toBeNull();
    });
  });

  describe('2. Telemetry Sampler & Accounting Invariants', () => {
    it('accurately samples process or browser memory without throwing', () => {
      const sample = TelemetrySampler.sampleMemory();
      expect(sample).toBeDefined();
      expect(sample.timestamp).toBeGreaterThan(0);
      expect(sample.source).toBeTruthy();
    });

    it('captures system resources snapshot with platform indicators', async () => {
      const snapshot = await TelemetrySampler.captureSystemResources();
      expect(snapshot).toBeDefined();
      expect(snapshot.platform).toBeTruthy();
      expect(typeof snapshot.isWebGPUSupported).toBe('boolean');
      expect(typeof snapshot.isWasmSupported).toBe('boolean');
    });
  });

  describe('3. Selected Model & Provider Resolution', () => {
    it('resolves LiteRT-LM configuration without silently switching models', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('gemma-4-e2b-it-web', 'litert-lm');

      const info = await TestOnceRunner.getCurrentlySelectedModelInfo();
      expect(info.provider).toBe('local-litert');
      expect(info.name).toContain('Gemma 4');
      expect(info.backend).toContain('LiteRT WebGPU');
    });

    it('resolves Ollama configuration when Ollama runtime is active', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('llama3.2:latest', 'ollama');

      const info = await TestOnceRunner.getCurrentlySelectedModelInfo();
      expect(info.provider).toBe('local-ollama');
      expect(info.name).toBe('llama3.2:latest');
      expect(info.backend).toContain('Ollama Local Daemon');
    });

    it('resolves Cloud BYOK provider when cloud mode is active', async () => {
      LocalAIConfig.setInferenceMode('cloud');
      LocalAIConfig.setPreferredCloudProvider('openrouter');

      const info = await TestOnceRunner.getCurrentlySelectedModelInfo();
      expect(info.provider).toBe('openrouter');
      expect(info.backend).toContain('Cloud Server Vaulted API');
    });
  });

  describe('4. Test Once Runner Execution Lifecycle', () => {
    it('executes Test Once and collects complete structured telemetry', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('gemma-2-2b-it-int4', 'litert-lm');

      const result = await TestOnceRunner.runTestOnce({
        query: 'What is YAI Studio?',
      });

      expect(result).toBeDefined();
      expect(result.testId).toMatch(/^test_/);
      expect(result.query).toBe('What is YAI Studio?');
      expect(result.model.provider).toBe('local-litert');
      expect(result.execution.status).toBe('COMPLETED');
      expect(result.execution.durationMs).toBeGreaterThan(0);

      // Verify Query Resources accounting
      expect(result.queryResources.totalElapsedTimeMs).toBeGreaterThan(0);
      expect(result.queryResources.totalInputTokens).toBeGreaterThan(0);
      expect(result.queryResources.totalOutputTokens).toBeGreaterThan(0);
      expect(result.queryResources.usedComponentsCount).toBeGreaterThan(0);
      expect(result.queryResources.notUsedComponentsCount).toBeGreaterThan(0);

      // Verify all registered components are present in report
      expect(result.components.length).toBe(REGISTERED_COMPONENTS.length);
      const usedUserPrompt = result.components.find((c) => c.componentId === 'user_prompt');
      expect(usedUserPrompt?.status).toBe('USED');
      expect(usedUserPrompt?.tokens.input).toBeGreaterThan(0);

      const uninvokedTool = result.components.find((c) => c.componentId === 'terminal_execution');
      expect(uninvokedTool?.status).toBe('NOT_USED');
      expect(uninvokedTool?.memory.allocatedBytes).toBe(0);

      // Verify steps
      expect(result.steps.length).toBeGreaterThanOrEqual(10);
      const step1 = result.steps.find((s) => s.stepId === 'stage_1_init');
      expect(step1?.status).toBe('COMPLETED');

      // Verify measurement coverage
      expect(result.measurementCoverage.totalRegisteredComponents).toBe(REGISTERED_COMPONENTS.length);
      expect(result.measurementCoverage.coveragePercentage).toBeGreaterThan(0);
    });

    it('prevents concurrent duplicate executions while a test is in flight', async () => {
      const runnerPromise = TestOnceRunner.runTestOnce({ query: 'Test 1' });
      expect(TestOnceRunner.isRunning()).toBe(true);

      await expect(
        TestOnceRunner.runTestOnce({ query: 'Duplicate Test' })
      ).rejects.toThrow('A test is already running');

      await runnerPromise;
      expect(TestOnceRunner.isRunning()).toBe(false);
    });

    it('captures failures and diagnostic information when runtime inference fails', async () => {
      // Configure Ollama pointing to an invalid port that will reject connection
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('non-existent-model', 'ollama');

      // Spy on OllamaClient.checkHealth to simulate daemon failure
      vi.spyOn(OllamaClient, 'checkHealth').mockResolvedValueOnce({
        state: 'DISCONNECTED',
        available: false,
        endpoint: 'http://127.0.0.1:11434',
        connectionMethod: 'Direct Browser',
        error: 'Ollama service is not reachable',
        checkedAt: new Date().toISOString(),
      });

      const result = await TestOnceRunner.runTestOnce({
        query: 'Query on failed daemon',
      });

      expect(result.execution.status).toBe('FAILED');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Ollama runtime unavailable');

      const failedStep = result.steps.find((s) => s.stepId === 'stage_2_runtime_check');
      expect(failedStep?.status).toBe('FAILED');
    });

    it('supports cancellation during execution', async () => {
      const controller = new AbortController();

      // Trigger cancel immediately after start
      const promise = TestOnceRunner.runTestOnce({
        query: 'Cancellation test query',
        signal: controller.signal,
      });

      controller.abort();
      const result = await promise;

      expect(result.execution.status).toBe('CANCELLED');
      expect(result.execution.cancelledAt).toBeDefined();
    });
  });

  describe('5. Persistence and Test History', () => {
    it('persists completed test runs into history and retrieves them', async () => {
      const result = await TestOnceRunner.runTestOnce({
        query: 'Persistence verification query',
      });

      const history = await TestHistoryStorage.getTestResults();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].testId).toBe(result.testId);
      expect(history[0].query).toBe('Persistence verification query');

      const single = await TestHistoryStorage.getTestResultById(result.testId);
      expect(single?.testId).toBe(result.testId);
    });

    it('clears test history when requested', async () => {
      await TestOnceRunner.runTestOnce({ query: 'Clear test query' });
      let history = await TestHistoryStorage.getTestResults();
      expect(history.length).toBeGreaterThanOrEqual(1);

      await TestHistoryStorage.clearTestHistory();
      history = await TestHistoryStorage.getTestResults();
      expect(history.length).toBe(0);
    });
  });
});
