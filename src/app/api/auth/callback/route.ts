import { NextResponse, type NextRequest } from 'next/server';
import { getYetVastAuthClient } from '@/lib/auth/yetvast-auth';
import { createSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(errorParam)}`, request.url),
    );
  }

  const storedState = request.cookies.get('yai_oauth_state')?.value;
  const codeVerifier = request.cookies.get('yai_oauth_verifier')?.value;

  if (!state || !storedState || state !== storedState || !code || !codeVerifier) {
    return NextResponse.redirect(
      new URL('/sign-in?error=invalid_oauth_state', request.url),
    );
  }

  try {
    const client = getYetVastAuthClient(request);
    const { assertion } = await client.exchangeCallback({
      code,
      codeVerifier,
    });

    const yvUserId = (assertion.yvUserId || assertion.sub) as string;
    const githubLogin =
      assertion.provider === 'github'
        ? (assertion.displayName || assertion.providerSubjectId)
        : undefined;

    const redirectTarget = githubLogin ? '/' : '/github-connect';
    const response = NextResponse.redirect(new URL(redirectTarget, request.url));

    // Clear OAuth state cookies
    response.cookies.delete('yai_oauth_state');
    response.cookies.delete('yai_oauth_verifier');

    // Create host-bound HTTP-only YAI session
    await createSession(
      {
        yvUserId,
        githubLogin,
        githubConnected: Boolean(githubLogin),
        repoVerified: false,
      },
      response,
    );

    return response;
  } catch (error) {
    console.error('[YAI Auth Callback] Verification failed:', error);
    return NextResponse.redirect(
      new URL('/sign-in?error=assertion_verification_failed', request.url),
    );
  }
}
