import { ExchangeList } from '@/components/staff/exchange-list';
import { StaffTitle } from '@/components/staff/staff-heading';
import { StaffNav } from '@/components/staff/staff-nav';
import { StaffForbidden } from '@/components/staff/staff-notice';
import { createStampRepository } from '@/lib/stamp-db';
import { recordRequest } from '@/lib/stamp-metrics';
import { authorizeStaffPage } from '@/lib/staff-page';

export const dynamic = 'force-dynamic';

export default async function StaffExchangesPage() {
  const started = Date.now();
  const auth = await authorizeStaffPage('/staff/exchanges');
  if (auth.kind === 'forbidden') return <StaffForbidden />;
  // 取得失敗の表示は Figma に無いため、例外にして共通のエラー画面に委ねる
  if (auth.kind === 'unavailable') throw new Error('stamp env unavailable');

  const r = await createStampRepository(auth.env.STAMP_DB).listExchanges();
  recordRequest(auth.env, {
    endpoint: 'staff_exchanges',
    outcome: r.ok ? 'ok' : 'failed',
    status: r.ok ? 200 : 503,
    requestBytes: 0,
    responseBytes: -1,
    totalMs: Date.now() - started,
    usage: r.usage,
    d1Failed: !r.ok,
  });
  if (!r.ok) throw new Error('listExchanges failed');

  return (
    <>
      <StaffTitle>交換済み一覧</StaffTitle>
      <StaffNav selected="exchanges" />
      <ExchangeList initial={r.value} />
    </>
  );
}
