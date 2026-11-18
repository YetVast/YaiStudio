import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import { reviewCandidate } from '@/lib/storage/personal-intelligence-storage';

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
    const { decision } = body;

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json(
        { error: 'decision must be "approved" or "rejected"' },
        { status: 400 },
      );
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    await reviewCandidate(ctx, id, decision);

    return NextResponse.json({ success: true, id, decision });
  } catch (error) {
    console.error(`[Candidate Review ${id}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to review candidate' },
      { status: 500 },
    );
  }
}
