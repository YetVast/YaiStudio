import { NextResponse, type NextRequest } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/auth/pkce';
import { buildAuthorizationUrl } from '@/lib/auth/yetvast-auth';

export async function GET(request: NextRequest) {
  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const authorizeUrl = await buildAuthorizationUrl(state, codeChallenge, 'S256');

    const response = NextResponse.redirect(authorizeUrl);

    // Short-lived cookie storing state & verifier for callback verification
    response.cookies.set('yai_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    response.cookies.set('yai_oauth_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[YAI Auth Authorize] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to initiate authorization',
        gate: 'Auth Registration Gate: Confirm YAI Studio application registration with Yet Vast Auth',
      },
      { status: 500 },
    );
  }
}
