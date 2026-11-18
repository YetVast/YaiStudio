import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  listKnowledge,
  createKnowledgeItem,
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
    const items = await listKnowledge(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[Knowledge List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list knowledge items' },
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
    const { title, content, source, sourceUrl, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const item = await createKnowledgeItem(ctx, {
      title,
      content,
      source,
      sourceUrl,
      tags: Array.isArray(tags) ? tags : [],
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('[Knowledge Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create knowledge item' },
      { status: 500 },
    );
  }
}
