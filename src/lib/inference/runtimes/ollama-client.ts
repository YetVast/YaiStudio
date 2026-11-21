/**
 * YAI Studio — Ollama Local Runtime Client
 *
 * Interacts with host Ollama service via /api/local-runtime/ollama/ proxy,
 * tracking process events, model lifecycle, and telemetry.
 */

import { processTelemetry } from '@/lib/telemetry/process-telemetry';

export interface OllamaHealthReport {
  available: boolean;
  version?: string;
  host?: string;
  error?: string;
  checkedAt: string;
}

export interface OllamaModelItem {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  expires_at: string;
}

export class OllamaClient {
  /** Check if Ollama daemon is reachable */
  static async checkHealth(): Promise<OllamaHealthReport> {
    const proc = processTelemetry.startProcess({
      operationType: 'health-check',
      operationName: 'Probe Ollama Runtime Health',
      provider: 'local-ollama',
      runtime: 'ollama',
      initialStage: 'Probing 127.0.0.1:11434',
    });

    try {
      const res = await fetch('/api/local-runtime/ollama/health');
      if (!res.ok) {
        throw new Error(`Health check returned HTTP ${res.status}`);
      }
      const data: OllamaHealthReport = await res.json();
      if (data.available) {
        processTelemetry.setCurrentRuntime('ollama');
        processTelemetry.setRuntimeHealth('healthy');
        processTelemetry.completeProcess(proc.id, undefined, `Ollama v${data.version} active`);
      } else {
        processTelemetry.setRuntimeHealth('offline');
        processTelemetry.completeProcess(proc.id, undefined, 'Ollama service offline');
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processTelemetry.failProcess(proc.id, msg);
      return {
        available: false,
        error: msg,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /** List installed models in Ollama */
  static async listModels(): Promise<OllamaModelItem[]> {
    try {
      const res = await fetch('/api/local-runtime/ollama/tags');
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  /** List loaded models in VRAM */
  static async listRunningModels(): Promise<OllamaRunningModel[]> {
    try {
      const res = await fetch('/api/local-runtime/ollama/ps');
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  /** Unload a model from memory */
  static async unloadModel(model: string): Promise<boolean> {
    const proc = processTelemetry.startProcess({
      operationType: 'model-unload',
      operationName: `Unload ${model} from VRAM`,
      provider: 'local-ollama',
      runtime: 'ollama',
      model,
      initialStage: 'Sending keep_alive: 0',
    });

    try {
      const res = await fetch('/api/local-runtime/ollama/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      if (res.ok) {
        processTelemetry.setLoadedModel(null);
        processTelemetry.completeProcess(proc.id, undefined, `Unloaded ${model} from memory`);
        return true;
      }
      throw new Error(`Unload returned HTTP ${res.status}`);
    } catch (err) {
      processTelemetry.failProcess(proc.id, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  /** Execute inference through Ollama */
  static async generate(options: {
    model: string;
    prompt: string;
    system?: string;
  }): Promise<{
    content: string;
    durationMs: number;
    tokensPerSecond?: number;
    evalCount?: number;
  }> {
    const proc = processTelemetry.startProcess({
      operationType: 'inference',
      operationName: `Ollama Inference (${options.model})`,
      provider: 'local-ollama',
      runtime: 'ollama',
      model: options.model,
      canCancel: false,
      initialStage: 'Submitting prompt to local daemon',
    });

    try {
      processTelemetry.appendLog(proc.id, 'Executing', 'Evaluating prompt tokens on local hardware');
      const res = await fetch('/api/local-runtime/ollama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      processTelemetry.completeProcess(
        proc.id,
        {
          durationMs: data.durationMs,
          tokensGenerated: data.evalCount,
          tokensPerSec: data.tokensPerSecond,
        },
        `Generated ${data.evalCount || 0} tokens (${data.tokensPerSecond || 0} tok/s)`
      );

      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processTelemetry.failProcess(proc.id, msg);
      throw err;
    }
  }
}
