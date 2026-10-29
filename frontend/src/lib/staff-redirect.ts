export function redirectResponse(
  request: Request,
  path: string,
  cookies: readonly string[] = [],
): Response {
  const headers = new Headers({
    Location: new URL(path, request.url).toString(),
    'Cache-Control': 'no-store',
  });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}
