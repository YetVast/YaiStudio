import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  listActivity,
  recordActivity,
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
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

  try {
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const events = await listActivity(ctx, { limit });
    return NextResponse.json({ events });
  } catch (error) {
    console.error('[Activity List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list activity' },
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
    const { sourceProduct, querySummary, responseSummary, executionMode, model, provider } = body;

    if (!sourceProduct) {
      return NextResponse.json({ error: 'sourceProduct is required' }, { status: 400 });
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const event = await recordActivity(ctx, {
      sourceProduct,
      querySummary,
      responseSummary,
      executionMode: executionMode || 'cloud',
      model,
      provider,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('[Activity Record] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record activity' },
      { status: 500 },
    );
  }
}
