import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  listWorkspaces,
  createWorkspace,
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

  const { searchParams } = new URL(request.url);
  const parent = searchParams.get('parent') || 'workspaces';

  try {
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const workspaces = await listWorkspaces(ctx, parent);
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('[Workspaces List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list workspaces' },
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
    const { name, parentPath, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const workspace = await createWorkspace(ctx, name, parentPath, description);

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error('[Workspace Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workspace' },
      { status: 500 },
    );
  }
}
