import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      yvUserId: session.yvUserId,
      githubLogin: session.githubLogin || null,
      githubConnected: session.githubConnected,
      repoVerified: session.repoVerified,
      expiresAt: new Date(session.exp * 1000).toISOString(),
    },
  });
}
