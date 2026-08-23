/**
 * Authentication boundary. Every organizer surface requires a session; a signed-out
 * visitor is returned to sign-in. The session's validity is checked at the data layer --
 * this only gates on the cookie's presence, cheaply, at the edge.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/dashboard',
  '/organization',
  '/notifications',
  '/events',
  '/venues',
  '/facilities',
];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const needsSession = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (needsSession && !request.cookies.get('session')) {
    const signin = request.nextUrl.clone();
    signin.pathname = '/signin';
    signin.search = '';
    return NextResponse.redirect(signin);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/organization/:path*',
    '/notifications/:path*',
    '/events/:path*',
    '/venues/:path*',
    '/facilities/:path*',
    '/dashboard',
    '/organization',
    '/notifications',
  ],
};
