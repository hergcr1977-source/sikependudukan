import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API without authentication
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    // Add no-cache headers and continue
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('session_id')?.value;

  // If no session, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add no-cache headers for authenticated responses
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    // Match all pages (not static files like _next, favicon, images, etc.)
    '/((?!_next/static|_next/image|favicon.ico|logo.png|sitemap.xml|robots.txt).*)',
  ],
};
