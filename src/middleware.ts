import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/sign-in',
  '/api/auth/authorize',
  '/api/auth/callback',
  '/api/auth/sign-out',
  '/favicon.ico',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internal paths
  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('yai_session');

  // If no session cookie on a protected web page, redirect to sign-in
  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signInUrl = new URL('/sign-in', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
