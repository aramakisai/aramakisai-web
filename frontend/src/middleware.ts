import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  FULLSCREEN_PRIVATE_PATHS,
  PHASE_OVERRIDE_COOKIE,
  isPublicPath,
  resolvePhase,
} from '@/lib/phase';

export function middleware(request: NextRequest): NextResponse {
  const { phase } = resolvePhase(
    request.cookies.get(PHASE_OVERRIDE_COOKIE)?.value,
  );
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname, phase)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  // (site)/gated はヘッダー・フッター付きの 404 を返す。(fullscreen) 配下のページは
  // ヘッダー・フッターを持たない前提のため、専用の rewrite 先へ振り分ける
  url.pathname = FULLSCREEN_PRIVATE_PATHS.includes(pathname)
    ? '/gated-fullscreen'
    : '/gated';
  url.search = '';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|.*\\.[^/]+$).*)',
  ],
};
