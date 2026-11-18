import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  initializeRepository,
  isInitialized,
  DATA_REPO_NAME,
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

  const ctx = { githubToken: token, githubLogin: session.githubLogin };
  const initialized = await isInitialized(ctx);

  return NextResponse.json({
    repository: `${session.githubLogin}/${DATA_REPO_NAME}`,
    isInitialized: initialized,
    proposedLayout: [
      'README.md',
      'yaiManifest.json',
      'conversationsIndex.json',
      'workspaces/',
      'unfiledConversations/',
      'memory/facts.json',
      'memory/preferences.json',
      'memory/interests.json',
      'memory/goals.json',
      'memory/relationships.json',
      'memory/decisions.json',
      'memory/candidates/',
      'knowledge/references/',
      'activity/YYYY/MM/',
    ],
  });
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
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const { createdFiles } = await initializeRepository(ctx);

    return NextResponse.json({
      success: true,
      createdFiles,
    });
  } catch (error) {
    console.error('[Storage Initialize] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Initialization failed' },
      { status: 500 },
    );
  }
}
