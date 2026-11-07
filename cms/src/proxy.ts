import { NextResponse, type NextRequest } from 'next/server'

const idPath = (segments: string[], length: number) => segments.length === length

/**
 * Payload が自動生成する内部コレクション/グローバルの REST は、access を上書きする公式の手段がない。
 * 管理画面がブラウザから実際に叩く経路だけを残し、それ以外は 404 にする。
 * 管理画面の使用箇所: ui providers/Preferences (GET/POST /:key)、providers/Locale (GET /:key)、
 * next views/Account/ResetPreferences (DELETE ?where[user.value][equals]=)、
 * ui providers/DocumentInfo (locked-documents の一覧 GET、/:id への PATCH/DELETE)
 */
export function isBlockedInternalApi(method: string, pathname: string, searchParams: URLSearchParams): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'api') return false
  const [, name, sub] = segments
  const preflight = method === 'OPTIONS'

  if (name === 'globals' && sub === 'payload-jobs-stats') return true
  if (name === 'payload-migrations') return true

  if (name === 'payload-preferences') {
    if (preflight) return false
    if (idPath(segments, 3)) return !['GET', 'POST', 'DELETE'].includes(method)
    // 「設定をリセット」。Payload 側の access が自分の行だけに絞る
    if (idPath(segments, 2)) return !(method === 'DELETE' && searchParams.has('where[user.value][equals]'))
    return true
  }

  if (name === 'payload-locked-documents') {
    if (preflight) return false
    if (idPath(segments, 2)) return method !== 'GET'
    if (idPath(segments, 3)) return !['PATCH', 'DELETE'].includes(method)
    return true
  }

  return false
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  if (isBlockedInternalApi(request.method, pathname, searchParams)) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.next()
}

// middleware は起動自体に CPU を使うため、ブロック対象の経路だけに絞る
export const config = {
  matcher: [
    '/api/payload-preferences/:path*',
    '/api/payload-locked-documents/:path*',
    '/api/payload-migrations/:path*',
    '/api/globals/payload-jobs-stats/:path*',
  ],
}
