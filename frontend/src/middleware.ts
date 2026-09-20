import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PHASE_OVERRIDE_COOKIE, isPublicPath, resolvePhase } from '@/lib/phase';

export function middleware(request: NextRequest): NextResponse {
  const { phase } = resolvePhase(
    request.cookies.get(PHASE_OVERRIDE_COOKIE)?.value,
  );

  if (isPublicPath(request.nextUrl.pathname, phase)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/gated';
  url.search = '';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.[^/]+$).*)',
  ],
};
