import { getExhibitionCatalog } from '@/lib/exhibitions';
import { handleStaffPost } from '@/lib/staff-api';
import { isComplete } from '@/lib/stamp-aggregate';
import { toStampTargets } from '@/lib/stamp-targets';
import { isVisitorId } from '@/lib/visitor-id';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleStaffPost(request, 'staff_register', async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      return {
        status: 400,
        body: { error: 'invalid_json' },
        outcome: 'invalid',
      };
    }
    const visitorId = (body as { visitorId?: unknown } | null)?.visitorId;
    if (!isVisitorId(visitorId)) {
      return {
        status: 400,
        body: { error: 'invalid_visitor_id' },
        outcome: 'invalid',
      };
    }

    const stamps = await ctx.repo.listStamps(visitorId);
    if (!stamps.ok) {
      return {
        status: 503,
        body: { error: 'unavailable' },
        outcome: 'failed',
        usage: stamps.usage,
        d1Failed: true,
      };
    }
    const { cards } = await getExhibitionCatalog();
    if (!isComplete(toStampTargets(cards), stamps.value)) {
      return {
        status: 409,
        body: { kind: 'not_eligible' },
        outcome: 'not_eligible',
        usage: stamps.usage,
      };
    }

    const reg = await ctx.repo.registerExchange(visitorId, ctx.staff, ctx.now);
    if (!reg.ok) {
      return {
        status: 503,
        body: { error: 'unavailable' },
        outcome: 'failed',
        usage: reg.usage,
        d1Failed: true,
      };
    }
    return {
      status: 200,
      body: reg.value,
      outcome: reg.value.kind,
      usage: reg.usage,
    };
  });
}
