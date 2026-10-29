import { StaffTitle } from '@/components/staff/staff-heading';
import { StaffNav } from '@/components/staff/staff-nav';
import {
  StaffForbidden,
  StaffStatusRow,
} from '@/components/staff/staff-notice';
import { StaffVisitorView } from '@/components/staff/staff-visitor-view';
import { verifyExchangeToken } from '@/lib/exchange-token';
import { getExhibitionCatalog } from '@/lib/exhibitions';
import { isComplete, summarizeVisitor } from '@/lib/stamp-aggregate';
import { createStampRepository } from '@/lib/stamp-db';
import { recordRequest } from '@/lib/stamp-metrics';
import { toStampTargets } from '@/lib/stamp-targets';
import { authorizeStaffPage } from '@/lib/staff-page';
import type { D1Usage } from '@/lib/stamp-db';
import { isVisitorId } from '@/lib/visitor-id';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffTitle>照会</StaffTitle>
      <StaffNav selected="none" />
      {children}
    </>
  );
}

export default async function StaffVisitorPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitorId: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const started = Date.now();
  const { visitorId } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : '';
  const query = token ? `?t=${encodeURIComponent(token)}` : '';
  const auth = await authorizeStaffPage(
    `/staff/visitors/${encodeURIComponent(visitorId)}${query}`,
  );
  if (auth.kind === 'forbidden') return <StaffForbidden />;
  if (auth.kind === 'unavailable') throw new Error('stamp env unavailable');
  const { env } = auth;

  const measure = (
    outcome: string,
    status: number,
    usage: D1Usage | null = null,
  ) =>
    recordRequest(env, {
      endpoint: 'staff_visitor',
      outcome,
      status,
      requestBytes: 0,
      responseBytes: -1,
      totalMs: Date.now() - started,
      usage,
      d1Failed: outcome === 'failed',
    });

  if (!isVisitorId(visitorId)) {
    measure('invalid_visitor_id', 200);
    return (
      <Shell>
        <StaffStatusRow>
          QRを読み取れませんでした。読み取り直してください
        </StaffStatusRow>
      </Shell>
    );
  }

  // 署名が不正な場合も期限切れと同じ案内にする (どちらも来場者が QR を出し直せば解消する)
  const check = await verifyExchangeToken(
    env.STAMP_SIGNING_SECRET,
    visitorId,
    token,
    new Date(),
  );
  if (check !== 'valid') {
    measure(`token_${check}`, 200);
    return (
      <Shell>
        <StaffStatusRow>
          交換用QRの有効期限が切れています。マイページで表示し直してもらってください
        </StaffStatusRow>
      </Shell>
    );
  }

  const [record, catalog] = await Promise.all([
    createStampRepository(env.STAMP_DB).getVisitorRecord(visitorId),
    getExhibitionCatalog(),
  ]);
  if (!record.ok) {
    measure('failed', 503, record.usage);
    throw new Error('getVisitorRecord failed');
  }
  measure('ok', 200, record.usage);

  const targets = toStampTargets(catalog.cards);
  return (
    <Shell>
      <StaffVisitorView
        visitorId={visitorId}
        summary={summarizeVisitor(targets, catalog.areas, record.value.stamps)}
        exchange={record.value.activeExchange}
        eligible={isComplete(targets, record.value.stamps)}
      />
    </Shell>
  );
}
