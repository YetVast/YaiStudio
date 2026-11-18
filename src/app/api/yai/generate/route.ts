import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  getConversation,
  appendMessage,
  getMemory,
  recordActivity,
} from '@/lib/storage/personal-intelligence-storage';
import { executeGeneration } from '@/lib/providers';
import type { GenerationMessage } from '@/lib/providers/types';

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json(
      { error: 'GitHub storage is not connected. Connect your data repository first.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { conversationId, message, model, provider = 'openrouter' } = body;

    if (!conversationId || !message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'conversationId and message are required' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };

    // 1. Fetch existing conversation
    const conv = await getConversation(ctx, conversationId);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 2. Fetch Personal Intelligence context (facts and preferences)
    let memoryContext = '';
    try {
      const [facts, preferences] = await Promise.all([
        getMemory(ctx, 'fact'),
        getMemory(ctx, 'preference'),
      ]);

      const activeFacts = facts.records.filter((r) => r.status === 'active');
      const activePrefs = preferences.records.filter((r) => r.status === 'active');

      if (activeFacts.length > 0 || activePrefs.length > 0) {
        memoryContext =
          'You are YAI, the Personal Intelligence assistant for Yet Vast Solutions.\n' +
          'User Personal Context:\n' +
          activeFacts.map((f) => `- Fact: ${f.content}`).join('\n') +
          '\n' +
          activePrefs.map((p) => `- Preference: ${p.content}`).join('\n') +
          '\n\nBe direct, insightful, and respect the user context.';
      }
    } catch (e) {
      console.warn('[YAI Generate] Failed to load memory context, proceeding without it:', e);
    }

    // 3. Assemble message history
    const history: GenerationMessage[] = conv.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: 'user', content: message.trim() });

    // 4. Append user message to canonical messages.json first
    await appendMessage(ctx, conversationId, {
      role: 'user',
      content: message.trim(),
      model: model || conv.meta.model,
      provider,
    });

    // 5. Execute cloud inference
    const generationResult = await executeGeneration(
      session.yvUserId,
      {
        messages: history,
        model: model || conv.meta.model || 'anthropic/claude-3.5-sonnet',
        systemPrompt: memoryContext || undefined,
      },
      provider,
    );

    // 6. Append assistant message to canonical messages.json
    const assistantMsg = await appendMessage(ctx, conversationId, {
      role: 'assistant',
      content: generationResult.content,
      model: generationResult.model,
      provider: generationResult.provider,
      tokenCount: (generationResult.inputTokens || 0) + (generationResult.outputTokens || 0),
    });

    // 7. Record activity event in ledger (async)
    try {
      await recordActivity(ctx, {
        sourceProduct: 'yai-studio',
        querySummary: message.slice(0, 100),
        responseSummary: generationResult.content.slice(0, 100),
        executionMode: 'cloud',
        model: generationResult.model,
        provider: generationResult.provider,
      });
    } catch (activityError) {
      console.warn('[YAI Generate] Failed to record activity event:', activityError);
    }

    return NextResponse.json({
      message: assistantMsg,
      model: generationResult.model,
      provider: generationResult.provider,
    });
  } catch (error) {
    console.error('[YAI Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
