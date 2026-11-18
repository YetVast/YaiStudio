import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import { appendMessage } from '@/lib/storage/personal-intelligence-storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { role, content, model, provider, tokenCount } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const message = await appendMessage(ctx, id, {
      role,
      content,
      model,
      provider,
      tokenCount,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error(`[Message Append ${id}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to append message' },
      { status: 500 },
    );
  }
}
