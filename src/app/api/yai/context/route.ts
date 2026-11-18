import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import { getMemory } from '@/lib/storage/personal-intelligence-storage';

export async function GET(request: NextRequest) {
  // Can be called via active session or future product API key
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const [facts, preferences, goals] = await Promise.all([
      getMemory(ctx, 'fact'),
      getMemory(ctx, 'preference'),
      getMemory(ctx, 'goal'),
    ]);

    return NextResponse.json({
      yvUserId: session.yvUserId,
      facts: facts.records.filter((r) => r.status === 'active'),
      preferences: preferences.records.filter((r) => r.status === 'active'),
      goals: goals.records.filter((r) => r.status === 'active'),
    });
  } catch (error) {
    console.error('[YAI Context] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve context' },
      { status: 500 },
    );
  }
}
