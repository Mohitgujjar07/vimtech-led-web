import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

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
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
