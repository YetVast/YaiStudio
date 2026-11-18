import { NextResponse, type NextRequest } from 'next/server';
import { getYetVastAuthClient } from '@/lib/auth/yetvast-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider =
      searchParams.get('provider') ||
      searchParams.get('identity_provider') ||
      undefined;

    const client = getYetVastAuthClient(request);
    const auth = await client.createAuthorizeRedirect({
      ...(provider ? { provider } : {}),
    });

    const response = NextResponse.redirect(auth.authorizeUrl);

    // Short-lived cookie storing state & verifier for callback verification
    response.cookies.set('yai_oauth_state', auth.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    response.cookies.set('yai_oauth_verifier', auth.codeVerifier, {
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
