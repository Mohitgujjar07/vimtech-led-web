import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth', '/api/backup', '/downloads'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/sw') ||
    /\.(ico|png|jpg|jpeg|svg|css|js|woff2?|webp|webmanifest|json|apk)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('lab_auth_session')?.value;

  if (sessionCookie !== 'authenticated') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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
