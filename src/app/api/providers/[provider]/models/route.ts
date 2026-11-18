import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { listModelsForProvider } from '@/lib/providers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await params;
  if (provider !== 'openrouter' && provider !== 'google-ai') {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  try {
    const models = await listModelsForProvider(session.yvUserId, provider);
    return NextResponse.json({ models });
  } catch (error) {
    console.error(`[Models List ${provider}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch models' },
      { status: 500 },
    );
  }
}
