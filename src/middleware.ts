import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'psycloud_session';

function secretKey() {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';
  return new TextEncoder().encode(s);
}

async function hasValidSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot') ||
    pathname.startsWith('/reset') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api/public')
  ) {
    return NextResponse.next();
  }

  const ok = await hasValidSession(req);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
