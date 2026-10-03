import { getParkingResponse } from '@/lib/parking-data';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(): Promise<Response> {
  const result = await getParkingResponse();
  if (!result.ok) {
    return Response.json(
      { error: 'cms_unavailable' },
      { status: 502, headers: HEADERS },
    );
  }
  return Response.json(result.value, { headers: HEADERS });
}
