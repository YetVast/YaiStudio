import { NextResponse, type NextRequest } from 'next/server';
import { requireSession, createSession } from '@/lib/auth/session';
import {
  exchangeGitHubCode,
  getGitHubUser,
  storeGitHubToken,
} from '@/lib/auth/github-storage-auth';

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('yai_gh_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL('/github-connect?error=invalid_github_state', request.url),
    );
  }

  try {
    const token = await exchangeGitHubCode(code, request);
    const user = await getGitHubUser(token);

    const response = NextResponse.redirect(new URL('/repo-setup', request.url));
    response.cookies.delete('yai_gh_oauth_state');

    // Store token securely encrypted server-side bound to user's identity & attach to cookie
    await storeGitHubToken(session.yvUserId, token, response);

    // Update session with connected GitHub login
    await createSession(
      {
        yvUserId: session.yvUserId,
        githubLogin: user.login,
        githubConnected: true,
        repoVerified: false,
      },
      response,
    );

    return response;
  } catch (error) {
    console.error('[GitHub Callback] Error:', error);
    return NextResponse.redirect(
      new URL('/github-connect?error=github_token_exchange_failed', request.url),
    );
  }
}
