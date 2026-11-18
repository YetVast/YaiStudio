import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getStoredGitHubToken } from '@/lib/auth/github-storage-auth';
import {
  getMemory,
  addMemoryRecord,
} from '@/lib/storage/personal-intelligence-storage';
import type { MemoryType } from '@/types/personal-intelligence';

const VALID_TYPES: Set<string> = new Set([
  'fact',
  'preference',
  'interest',
  'goal',
  'relationship',
  'decision',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type: rawType } = await params;
  // Normalize plural or singular (e.g. facts -> fact)
  const type = rawType.replace(/s$/, '') as MemoryType;

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: `Invalid memory category: ${rawType}` }, { status: 400 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const memoryFile = await getMemory(ctx, type);
    return NextResponse.json(memoryFile);
  } catch (error) {
    console.error(`[Memory Get ${type}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve memory' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type: rawType } = await params;
  const type = rawType.replace(/s$/, '') as MemoryType;

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: `Invalid memory category: ${rawType}` }, { status: 400 });
  }

  const token = await getStoredGitHubToken(session.yvUserId);
  if (!token || !session.githubLogin) {
    return NextResponse.json({ error: 'GitHub storage not authorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, provenance, source, confidence } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const ctx = { githubToken: token, githubLogin: session.githubLogin };
    const record = await addMemoryRecord(ctx, type, {
      content,
      provenance,
      source,
      status: 'active',
      confidence,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error(`[Memory Add ${type}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add memory record' },
      { status: 500 },
    );
  }
}
