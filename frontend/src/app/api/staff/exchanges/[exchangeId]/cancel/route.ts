import { handleStaffPost } from '@/lib/staff-api';

export const dynamic = 'force-dynamic';

export function POST(
  request: Request,
  { params }: { params: Promise<{ exchangeId: string }> },
): Promise<Response> {
  return handleStaffPost(request, 'staff_cancel', async (ctx) => {
    const raw = (await params).exchangeId;
    const exchangeId = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : null;
    if (exchangeId === null) {
      return {
        status: 404,
        body: { error: 'not_found' },
        outcome: 'not_found',
      };
    }
    const r = await ctx.repo.cancelExchange(exchangeId, ctx.staff, ctx.now);
    if (!r.ok) {
      return {
        status: 503,
        body: { error: 'unavailable' },
        outcome: 'failed',
        usage: r.usage,
        d1Failed: true,
      };
    }
    if (r.value.kind === 'not_found') {
      return {
        status: 404,
        body: { error: 'not_found' },
        outcome: 'not_found',
        usage: r.usage,
      };
    }
    return {
      status: 200,
      body: r.value,
      outcome: r.value.kind,
      usage: r.usage,
    };
  });
}
