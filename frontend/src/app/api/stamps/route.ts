import { runStampApi } from '@/lib/stamp-api';
import { createStampRepository } from '@/lib/stamp-db';
import { isVisitorId } from '@/lib/visitor-id';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return runStampApi(
    request,
    'stamps',
    { status: 503, body: { error: 'unavailable' } },
    async (env) => {
      const visitorId = new URL(request.url).searchParams.get('visitorId');
      if (!isVisitorId(visitorId)) {
        return {
          status: 400,
          body: { error: 'invalid_visitor_id' },
          outcome: 'invalid',
        };
      }
      const r = await createStampRepository(env.STAMP_DB).listStamps(visitorId);
      if (!r.ok) {
        return {
          status: 503,
          body: { error: 'unavailable' },
          outcome: 'failed',
          usage: r.usage,
          d1Failed: true,
        };
      }
      return {
        status: 200,
        body: { stamps: r.value },
        outcome: 'ok',
        usage: r.usage,
      };
    },
  );
}
