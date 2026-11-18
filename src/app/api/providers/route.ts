import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { listConfiguredProviders } from '@/lib/providers/key-store';

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const providers = await listConfiguredProviders(session.yvUserId);
    return NextResponse.json({
      providers,
      limitationNote:
        'Server-side AES-256-GCM encrypted vault (Vercel KV REST API + Encrypted Host-Bound Cookie fallback).',
    });
  } catch (error) {
    console.error('[Providers List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve providers' },
      { status: 500 },
    );
  }
}
