import { NextResponse, type NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  // Origin verification
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid origin header' }, { status: 400 });
    }
  }

  const response = NextResponse.json({ success: true });
  destroySession(response);
  return response;
}
