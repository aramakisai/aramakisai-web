import { runStampApi } from '@/lib/stamp-api';
import { createStampRepository } from '@/lib/stamp-db';
import { isStampCategory, verifyStamp } from '@/lib/stamp-signature';
import { isVisitorId } from '@/lib/visitor-id';

export const dynamic = 'force-dynamic';

const MAX_SIGNATURE_LENGTH = 64;

export async function POST(request: Request): Promise<Response> {
  return runStampApi(
    request,
    'verify',
    { status: 200, body: { result: 'failed' } },
    async (env, text) => {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return {
          status: 400,
          body: { error: 'invalid_json' },
          outcome: 'invalid_json',
        };
      }
      const invalid = {
        status: 200,
        body: { result: 'invalid' },
        outcome: 'invalid',
      };
      if (typeof body !== 'object' || body === null) return invalid;
      const { id, category, signature, visitorId } = body as Record<
        string,
        unknown
      >;
      if (
        typeof id !== 'number' ||
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof category !== 'string' ||
        !isStampCategory(category) ||
        typeof signature !== 'string' ||
        signature.length > MAX_SIGNATURE_LENGTH ||
        !isVisitorId(visitorId) ||
        !(await verifyStamp(env.STAMP_SIGNING_SECRET, id, category, signature))
      ) {
        return invalid;
      }
      const r = await createStampRepository(env.STAMP_DB).recordStamp(
        visitorId,
        id,
        category,
        new Date(),
      );
      if (!r.ok) {
        return {
          status: 200,
          body: { result: 'failed' },
          outcome: 'failed',
          usage: r.usage,
          d1Failed: true,
          exhibitionId: id,
          category,
        };
      }
      return {
        status: 200,
        body: { result: r.value },
        outcome: r.value,
        usage: r.usage,
        exhibitionId: id,
        category,
      };
    },
  );
}
