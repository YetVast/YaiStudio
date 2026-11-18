import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  getConversation,
  updateConversationMeta,
} from '@/lib/storage/personal-intelligence-storage';

export async function GET(
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
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const conversation = await getConversation(ctx, id);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error(`[Conversation Get ${id}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve conversation' },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const { title, status, metaSha } = body;

    if (!metaSha) {
      return NextResponse.json(
        { error: 'metaSha is required for safe SHA-aware update' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const updated = await updateConversationMeta(ctx, id, { title, status }, metaSha);

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`[Conversation Update ${id}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update conversation' },
      { status: 500 },
    );
  }
}
