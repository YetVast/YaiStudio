import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const PROBE_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = PROBE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = await params;

  if (action === 'health') {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/version`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          available: true,
          runtime: 'ollama',
          version: data.version || 'unknown',
          host: OLLAMA_HOST,
          checkedAt: new Date().toISOString(),
        });
      }
      return NextResponse.json({
        available: false,
        runtime: 'ollama',
        error: `Ollama returned HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      return NextResponse.json({
        available: false,
        runtime: 'ollama',
        error: 'Ollama daemon is not reachable at 127.0.0.1:11434. Start Ollama locally to enable Ollama runtime.',
        checkedAt: new Date().toISOString(),
      });
    }
  }

  if (action === 'tags') {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
      return NextResponse.json({ error: `Failed to fetch tags: HTTP ${res.status}` }, { status: res.status });
    } catch (err) {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama daemon', models: [] },
        { status: 503 }
      );
    }
  }

  if (action === 'ps') {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/ps`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
      return NextResponse.json({ models: [] });
    } catch {
      return NextResponse.json({ models: [] });
    }
  }

  return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = await params;
  const body = await request.json().catch(() => ({}));

  if (action === 'unload') {
    // Ollama unloads a model by setting keep_alive: 0
    const model = body.model;
    if (!model) {
      return NextResponse.json({ error: 'Model name required' }, { status: 400 });
    }

    try {
      const res = await fetchWithTimeout(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 }),
      });
      return NextResponse.json({ success: res.ok, model });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to unload model from Ollama' }, { status: 500 });
    }
  }

  if (action === 'generate') {
    const { model, prompt, system } = body;
    if (!model || !prompt) {
      return NextResponse.json({ error: 'Model and prompt required' }, { status: 400 });
    }

    try {
      const startTime = performance.now();
      const res = await fetchWithTimeout(
        `${OLLAMA_HOST}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            system,
            stream: false,
          }),
        },
        60000 // 60s generation timeout
      );

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Ollama generation error: ${errText}` }, { status: res.status });
      }

      const data = await res.json();
      const durationMs = Math.round(performance.now() - startTime);

      return NextResponse.json({
        content: data.response || '',
        model: data.model || model,
        durationMs,
        evalCount: data.eval_count,
        evalDurationNs: data.eval_duration,
        tokensPerSecond:
          data.eval_count && data.eval_duration
            ? Math.round((data.eval_count / (data.eval_duration / 1e9)) * 10) / 10
            : undefined,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Ollama inference failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: `Unsupported POST action: ${action}` }, { status: 400 });
}
