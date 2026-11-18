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
        'V0 Key Storage: Keys are held in encrypted server-side memory. Configure persistent secret storage before production multi-instance deployment.',
    });
  } catch (error) {
    console.error('[Providers List] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve providers' },
      { status: 500 },
    );
  }
}
