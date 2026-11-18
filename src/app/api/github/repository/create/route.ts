import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import * as gh from '@/lib/github/api-client';
import { DATA_REPO_NAME, verifyRepository } from '@/lib/storage/personal-intelligence-storage';

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json(
      { error: 'GitHub storage is not authorized. Please authorize GitHub storage access first.' },
      { status: 403 },
    );
  }

  try {
    // 1. Verify if it already exists
    const existing = await verifyRepository({
      githubToken: token,
      githubLogin: session.githubLogin,
    });

    if (existing.exists) {
      if (!existing.isPrivate) {
        return NextResponse.json(
          {
            error: `Repository ${DATA_REPO_NAME} exists but is not private. Personal Intelligence must be stored in a private repository.`,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'Repository already exists and is private',
      });
    }

    // 2. Explicit creation of private repo
    const created = await gh.createRepository(
      DATA_REPO_NAME,
      true, // isPrivate = true
      token,
      'Private Personal Intelligence storage managed by YAI Studio (Yet Vast Solutions)',
    );

    // 3. Post-creation verification
    const verified = await verifyRepository({
      githubToken: token,
      githubLogin: session.githubLogin,
    });

    if (!verified.exists || !verified.isPrivate || !verified.ownerMatch) {
      return NextResponse.json(
        {
          error: 'Repository created but post-creation verification failed. Please check your GitHub account permissions.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      repository: created.full_name,
      url: created.html_url,
    });
  } catch (error) {
    console.error('[Repository Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create repository' },
      { status: 500 },
    );
  }
}
