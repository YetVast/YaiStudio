import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { buildGitHubAuthUrl } from '@/lib/auth/github-storage-auth';
import { generateState } from '@/lib/auth/pkce';

export async function GET(request: NextRequest) {
  try {
    await requireSession(request);
  } catch {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  try {
    const state = generateState();
    const authUrl = buildGitHubAuthUrl(state, request);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('yai_gh_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[GitHub Connect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GitHub authorization initiation failed' },
      { status: 500 },
    );
  }
}
