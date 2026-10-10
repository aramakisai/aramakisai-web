import { getSignageSnapshot } from '@/lib/signage-data';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  const result = await getSignageSnapshot({ fresh });
  if (!result.ok) {
    return Response.json(
      { error: 'cms_unavailable' },
      { status: 502, headers: HEADERS },
    );
  }
  return Response.json(result.value, { headers: HEADERS });
}
