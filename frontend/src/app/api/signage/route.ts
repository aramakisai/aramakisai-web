import { getSignageSnapshot } from '@/lib/signage-data';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('v');
  const parsed = raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  const version = Number.isSafeInteger(parsed) ? parsed : undefined;
  const result = await getSignageSnapshot({ version });
  if (!result.ok) {
    return Response.json(
      { error: 'cms_unavailable' },
      { status: 502, headers: HEADERS },
    );
  }
  return Response.json(result.value, { headers: HEADERS });
}
