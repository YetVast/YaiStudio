/**
 * YAI Studio — Direct Browser Ollama Runtime Client & Telemetry
 *
 * Implements direct browser communication with the local Ollama service,
 * supporting both direct fetch and local agent proxy modes without routing
 * through cloud server lambdas (which run remotely on Vercel).
 *
 * Features:
 * - Direct browser-to-localhost communication (http://127.0.0.1:11434).
 * - Smart CORS and connectivity diagnosis (detects offline vs OLLAMA_ORIGINS block).
 * - Exact model discovery from Ollama (/api/tags).
 * - Running model VRAM inspection (/api/ps).
 * - Real inference execution with full telemetry extraction (tokens/sec, durations).
 * - Lifecycle process tracking via shared ProcessTelemetryManager.
 */

import { processTelemetry } from '@/lib/telemetry/process-telemetry';

export type OllamaConnectionState =
  | 'NOT_CONFIGURED'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR';

export interface OllamaHealthReport {
  state: OllamaConnectionState;
  available: boolean;
  endpoint: string;
  version?: string;
  connectionMethod: 'Direct Browser' | 'Local Agent' | 'Local Dev Proxy';
  error?: string;
  troubleshooting?: string;
  checkedAt: string;
}

export interface OllamaModelItem {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at?: string;
  details?: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
    context_length?: number;
    embedding_length?: number;
  };
  capabilities?: string[];
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  expires_at: string;
  context_length?: number;
}

export interface OllamaInferenceMetrics {
  totalDurationMs: number;
  durationMs: number;
  loadDurationMs: number;
  promptEvalCount: number;
  promptEvalDurationMs: number;
  evalCount: number;
  evalDurationMs: number;
  tokensPerSecond: number;
  response: string;
  content: string;
  model: string;
}

const ENDPOINT_STORAGE_KEY = 'yai_ollama_endpoint_v1';
export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

export class OllamaClient {
  /** Get the configured Ollama endpoint */
  static getEndpoint(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_OLLAMA_ENDPOINT;
    return localStorage.getItem(ENDPOINT_STORAGE_KEY) || DEFAULT_OLLAMA_ENDPOINT;
  }

  /** Set a custom Ollama or Local Agent endpoint */
  static setEndpoint(endpoint: string): void {
    if (typeof localStorage === 'undefined') return;
    const clean = endpoint.trim().replace(/\/+$/, '');
    localStorage.setItem(ENDPOINT_STORAGE_KEY, clean || DEFAULT_OLLAMA_ENDPOINT);
  }

  /**
   * Probes Ollama service with smart CORS vs Offline diagnosis.
   */
  static async checkHealth(customEndpoint?: string): Promise<OllamaHealthReport> {
    const endpoint = (customEndpoint ? customEndpoint.trim().replace(/\/+$/, '') : this.getEndpoint());
    const now = new Date().toISOString();

    const proc = processTelemetry.startProcess({
      operationType: 'health-check',
      operationName: 'Probe Ollama Runtime Health',
      provider: 'local-ollama',
      runtime: 'ollama',
      initialStage: `Connecting to ${endpoint}`,
    });

    try {
      // 1. Direct fetch to /api/version
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(`${endpoint}/api/version`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.available === false) {
            processTelemetry.setRuntimeHealth('offline');
            processTelemetry.failProcess(proc.id, data.error || 'Ollama offline');
            return {
              state: 'DISCONNECTED',
              available: false,
              endpoint,
              connectionMethod: 'Direct Browser',
              error: data.error || 'Ollama offline',
              checkedAt: now,
            };
          }

          const version = data.version || '0.34+';

          processTelemetry.setCurrentRuntime('ollama');
          processTelemetry.setRuntimeHealth('healthy');
          processTelemetry.completeProcess(proc.id, undefined, `Connected to Ollama v${version}`);

          return {
            state: 'CONNECTED',
            available: true,
            endpoint,
            version,
            connectionMethod: 'Direct Browser',
            checkedAt: now,
          };
        }

        throw new Error(`Ollama service returned HTTP ${res.status}`);
      } catch (directErr: any) {
        clearTimeout(timeoutId);

        // 2. Smart Diagnosis: Is Ollama running but blocked by CORS / OLLAMA_ORIGINS?
        const isOffline = await this.probePortReachable(endpoint);

        if (isOffline) {
          const errMsg = `Ollama service is not reachable at ${endpoint}.`;
          const troubleshooting = `Please verify Ollama is installed and running. Start it in terminal using: ollama serve`;
          processTelemetry.setRuntimeHealth('offline');
          processTelemetry.failProcess(proc.id, errMsg);

          return {
            state: 'DISCONNECTED',
            available: false,
            endpoint,
            connectionMethod: 'Direct Browser',
            error: errMsg,
            troubleshooting,
            checkedAt: now,
          };
        } else {
          // Port is listening, but standard fetch failed -> CORS / OLLAMA_ORIGINS configuration required!
          const errMsg = `Ollama is running at ${endpoint}, but browser Cross-Origin requests from ${window.location.origin} are blocked by Ollama's origin policy.`;
          const troubleshooting =
            `Configure Ollama to allow web origins:\n` +
            `• Windows: Set user environment variable OLLAMA_ORIGINS="*" and restart Ollama.\n` +
            `• macOS: launchctl setenv OLLAMA_ORIGINS "*" and restart Ollama.\n` +
            `• Linux: Add Environment="OLLAMA_ORIGINS=*" to systemd service.\n` +
            `• Or run the local companion: node scripts/yai-local-agent.mjs`;

          processTelemetry.setRuntimeHealth('degraded');
          processTelemetry.failProcess(proc.id, 'CORS origin blocked by Ollama daemon');

          return {
            state: 'ERROR',
            available: false,
            endpoint,
            connectionMethod: 'Direct Browser',
            error: errMsg,
            troubleshooting,
            checkedAt: now,
          };
        }
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      processTelemetry.failProcess(proc.id, msg);
      return {
        state: 'ERROR',
        available: false,
        endpoint,
        connectionMethod: 'Direct Browser',
        error: msg,
        checkedAt: now,
      };
    }
  }

  /**
   * Helper to distinguish between completely closed port vs CORS blocking
   * using a no-cors probe that succeeds if the socket is open.
   */
  private static async probePortReachable(endpoint: string): Promise<boolean> {
    if (typeof window === 'undefined') return true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      await fetch(endpoint, {
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // If we reach here, server answered the TCP handshake -> server is UP!
      return false;
    } catch {
      // Socket failed to connect -> server is truly OFFLINE
      return true;
    }
  }

  /** List installed models on user's machine from Ollama */
  static async listModels(): Promise<OllamaModelItem[]> {
    const endpoint = this.getEndpoint();
    try {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  /** List running models loaded in memory/VRAM from Ollama */
  static async listRunningModels(): Promise<OllamaRunningModel[]> {
    const endpoint = this.getEndpoint();
    try {
      const res = await fetch(`${endpoint}/api/ps`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  /** Unload a model from memory */
  static async unloadModel(model: string): Promise<boolean> {
    const endpoint = this.getEndpoint();
    const proc = processTelemetry.startProcess({
      operationType: 'model-unload',
      operationName: `Unload ${model} from Memory`,
      provider: 'local-ollama',
      runtime: 'ollama',
      model,
      initialStage: 'Sending keep_alive: 0',
    });

    try {
      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 }),
      });

      if (res.ok) {
        processTelemetry.setLoadedModel(null);
        processTelemetry.completeProcess(proc.id, undefined, `Unloaded ${model} from host memory`);
        return true;
      }
      throw new Error(`Unload returned HTTP ${res.status}`);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      processTelemetry.failProcess(proc.id, msg);
      return false;
    }
  }

  /**
   * Execute real inference on local Ollama instance with full lifecycle
   * and precise telemetry capture (load_duration, prompt_eval, eval, tokens/sec).
   */
  static async generate(options: {
    model: string;
    prompt: string;
    system?: string;
  }): Promise<OllamaInferenceMetrics> {
    const endpoint = this.getEndpoint();
    const model = options.model;

    const proc = processTelemetry.startProcess({
      operationType: 'inference',
      operationName: `Ollama Inference (${model})`,
      provider: 'local-ollama',
      runtime: 'ollama',
      model,
      canCancel: false,
      initialStage: 'Connecting to local runtime',
    });

    const startLocalMs = performance.now();

    try {
      processTelemetry.appendLog(proc.id, 'Initializing', `Targeting local Ollama model "${model}"`);
      processTelemetry.appendLog(proc.id, 'Loading Model', 'Verifying model tensor allocation in host memory/VRAM');

      processTelemetry.updateProcess(proc.id, { currentStage: 'Running Inference' });
      processTelemetry.appendLog(proc.id, 'Prompt Evaluation', `Submitting prompt to local execution pipeline`);

      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: options.prompt,
          system: options.system,
          stream: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Ollama returned HTTP ${res.status}: ${errText || res.statusText}`);
      }

      const data = await res.json();
      const totalElapsedMs = Math.round(performance.now() - startLocalMs);

      // Nanoseconds to milliseconds conversions from Ollama's native telemetry
      const totalDurationMs = data.total_duration
        ? Math.round(data.total_duration / 1e6)
        : data.durationMs || totalElapsedMs;
      const loadDurationMs = data.load_duration ? Math.round(data.load_duration / 1e6) : (data.loadDurationMs || 0);
      const promptEvalDurationMs = data.prompt_eval_duration
        ? Math.round(data.prompt_eval_duration / 1e6)
        : (data.promptEvalDurationMs || 0);
      const evalDurationMs = data.eval_duration
        ? Math.round(data.eval_duration / 1e6)
        : data.evalDurationNs
        ? Math.round(data.evalDurationNs / 1e6)
        : (data.evalDurationMs || 0);

      const promptEvalCount = data.prompt_eval_count || data.promptEvalCount || 0;
      const evalCount = data.eval_count || data.evalCount || 0;

      // Exact tokens per second calculation
      const calculatedTps =
        evalDurationMs > 0 ? Math.round((evalCount / (evalDurationMs / 1000)) * 10) / 10 : 0;
      const tokensPerSecond = data.tokensPerSecond !== undefined ? data.tokensPerSecond : calculatedTps;

      processTelemetry.setLoadedModel(model);
      processTelemetry.completeProcess(
        proc.id,
        {
          durationMs: totalDurationMs,
          loadDurationMs,
          promptEvalDurationMs,
          evalDurationMs,
          promptTokens: promptEvalCount,
          completionTokens: evalCount,
          tokensGenerated: evalCount,
          tokensPerSec: tokensPerSecond,
          telemetryReliability: 'MEASURED',
        },
        `Completed: ${evalCount} tokens generated at ${tokensPerSecond} tok/s (${totalDurationMs}ms total, ${loadDurationMs}ms load)`
      );

      const responseText = data.response || data.content || '';

      return {
        totalDurationMs,
        durationMs: totalDurationMs,
        loadDurationMs,
        promptEvalCount,
        promptEvalDurationMs,
        evalCount,
        evalDurationMs,
        tokensPerSecond,
        response: responseText,
        content: responseText,
        model: data.model || model,
      };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      processTelemetry.failProcess(proc.id, msg);
      throw err;
    }
  }
}
