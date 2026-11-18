import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  getConversationsIndex,
  createConversation,
} from '@/lib/storage/personal-intelligence-storage';

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const index = await getConversationsIndex(ctx);
    return NextResponse.json(index);
  } catch (error) {
    console.error('[Conversations List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list conversations' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title : 'New Conversation';
    const workspacePath = typeof body.workspacePath === 'string' ? body.workspacePath : null;
    const model = typeof body.model === 'string' ? body.model : undefined;
    const provider = typeof body.provider === 'string' ? body.provider : undefined;

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const meta = await createConversation(ctx, title, workspacePath, model, provider);

    return NextResponse.json(meta, { status: 201 });
  } catch (error) {
    console.error('[Conversation Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create conversation' },
      { status: 500 },
    );
  }
}
