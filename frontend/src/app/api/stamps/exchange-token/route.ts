import { getExhibitionCatalog } from '@/lib/exhibitions';
import { issueExchangeToken } from '@/lib/exchange-token';
import { runStampApi } from '@/lib/stamp-api';
import { isComplete } from '@/lib/stamp-aggregate';
import { createStampRepository } from '@/lib/stamp-db';
import { toStampTargets } from '@/lib/stamp-targets';
import { isVisitorId } from '@/lib/visitor-id';

export const dynamic = 'force-dynamic';

const unavailable = { error: 'unavailable' };

export async function POST(request: Request): Promise<Response> {
  return runStampApi(
    request,
    'exchange_token',
    { status: 503, body: unavailable },
    async (env, text) => {
      let visitorId: unknown;
      try {
        visitorId = (JSON.parse(text) as { visitorId?: unknown } | null)
          ?.visitorId;
      } catch {
        visitorId = undefined;
      }
      if (!isVisitorId(visitorId)) {
        return {
          status: 400,
          body: { error: 'invalid_visitor_id' },
          outcome: 'invalid',
        };
      }
      const failed = { status: 503, body: unavailable, outcome: 'failed' };
      let targets;
      try {
        targets = toStampTargets((await getExhibitionCatalog()).cards);
      } catch {
        return failed;
      }
      const r = await createStampRepository(env.STAMP_DB).listStamps(visitorId);
      if (!r.ok) return { ...failed, usage: r.usage, d1Failed: true };
      if (!isComplete(targets, r.value)) {
        return {
          status: 403,
          body: { error: 'not_eligible' },
          outcome: 'not_eligible',
          usage: r.usage,
        };
      }
      const { token, expiresAt } = await issueExchangeToken(
        env.STAMP_SIGNING_SECRET,
        visitorId,
        new Date(),
      );
      const url = `${new URL(request.url).origin}/staff/visitors/${visitorId}?t=${encodeURIComponent(token)}`;
      return {
        status: 200,
        body: { url, expiresAt },
        outcome: 'ok',
        usage: r.usage,
      };
    },
  );
}
