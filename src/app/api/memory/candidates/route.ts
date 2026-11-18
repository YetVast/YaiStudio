import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  listCandidates,
  addCandidate,
} from '@/lib/storage/personal-intelligence-storage';
import type { MemoryType } from '@/types/personal-intelligence';

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
    const candidates = await listCandidates(ctx);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('[Candidates List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list candidates' },
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
    const { proposedType, proposedContent, sourceActivityId, sourceConversationId } = body;

    if (!proposedType || !proposedContent) {
      return NextResponse.json(
        { error: 'proposedType and proposedContent are required' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const candidate = await addCandidate(ctx, {
      proposedType: proposedType as MemoryType,
      proposedContent,
      sourceActivityId,
      sourceConversationId,
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error('[Candidate Add] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add candidate' },
      { status: 500 },
    );
  }
}
