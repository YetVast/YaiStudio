import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import { verifyRepository, isInitialized, DATA_REPO_NAME } from '@/lib/storage/personal-intelligence-storage';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({
      connected: false,
      repoName: DATA_REPO_NAME,
    });
  }

  try {
    const ctx = {
      githubToken: token,
      githubLogin: session.githubLogin,
    };

    const repoStatus = await verifyRepository(ctx);
    let initialized = false;

    if (repoStatus.exists && repoStatus.isPrivate && repoStatus.ownerMatch) {
      initialized = await isInitialized(ctx);
    }

    return NextResponse.json({
      connected: true,
      githubLogin: session.githubLogin,
      repoName: DATA_REPO_NAME,
      repoExists: repoStatus.exists,
      repoPrivate: repoStatus.isPrivate,
      repoOwnerMatch: repoStatus.ownerMatch,
      isInitialized: initialized,
    });
  } catch (error) {
    console.error('[GitHub Connection Check] Error:', error);
    return NextResponse.json(
      {
        connected: true,
        githubLogin: session.githubLogin,
        repoName: DATA_REPO_NAME,
        error: error instanceof Error ? error.message : 'Failed to verify repository',
      },
      { status: 500 },
    );
  }
}
