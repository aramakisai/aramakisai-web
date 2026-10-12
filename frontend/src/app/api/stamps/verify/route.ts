import { isStampCategory, verifyStamp } from '@/lib/stamp-signature';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };
const MAX_SIGNATURE_LENGTH = 64;

async function readSecret(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const secret = (
      getCloudflareContext().env as { STAMP_SIGNING_SECRET?: unknown }
    ).STAMP_SIGNING_SECRET;
    return typeof secret === 'string' && secret !== '' ? secret : null;
  } catch {
    return null;
  }
}

async function isValid(body: unknown): Promise<boolean> {
  if (typeof body !== 'object' || body === null) return false;
  const { id, category, signature } = body as Record<string, unknown>;
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof category !== 'string' ||
    !isStampCategory(category) ||
    typeof signature !== 'string' ||
    signature.length > MAX_SIGNATURE_LENGTH
  ) {
    return false;
  }
  const secret = await readSecret();
  if (!secret) return false;
  return verifyStamp(secret, id, category, signature);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'invalid_json' },
      { status: 400, headers: HEADERS },
    );
  }
  return Response.json({ valid: await isValid(body) }, { headers: HEADERS });
}
