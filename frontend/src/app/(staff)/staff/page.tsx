import {
  StaffDashboardError,
  StaffDashboardView,
} from '@/components/staff/staff-dashboard-view';
import { StaffTitle } from '@/components/staff/staff-heading';
import { StaffNav } from '@/components/staff/staff-nav';
import { StaffForbidden } from '@/components/staff/staff-notice';
import { getExhibitionCatalog } from '@/lib/exhibitions';
import { createStampRepository } from '@/lib/stamp-db';
import { aggregate, type Dashboard } from '@/lib/stamp-aggregate';
import { recordRequest } from '@/lib/stamp-metrics';
import { toStampTargets } from '@/lib/stamp-targets';
import { authorizeStaffPage } from '@/lib/staff-page';
import type { StampEnv } from '@/lib/cloudflare-env';
import type { D1Usage } from '@/lib/stamp-db';

export const dynamic = 'force-dynamic';

type Loaded = {
  dashboard: Dashboard | null;
  usage: D1Usage | null;
  // D1 の失敗は 'failed'、CMS カタログの失敗は 'error' で区別する
  outcome: 'ok' | 'failed' | 'error';
};

async function load(env: StampEnv): Promise<Loaded> {
  try {
    const [records, catalog] = await Promise.allSettled([
      createStampRepository(env.STAMP_DB).loadAllRecords(),
      getExhibitionCatalog(),
    ]);
    if (records.status === 'rejected') {
      return { dashboard: null, usage: null, outcome: 'failed' };
    }
    const { usage } = records.value;
    if (!records.value.ok) return { dashboard: null, usage, outcome: 'failed' };
    if (catalog.status === 'rejected') {
      return { dashboard: null, usage, outcome: 'error' };
    }
    return {
      dashboard: aggregate(
        toStampTargets(catalog.value.cards),
        catalog.value.areas,
        records.value.value,
      ),
      usage,
      outcome: 'ok',
    };
  } catch {
    return { dashboard: null, usage: null, outcome: 'failed' };
  }
}

export default async function StaffDashboardPage() {
  const started = Date.now();
  const auth = await authorizeStaffPage('/staff');
  if (auth.kind === 'forbidden') return <StaffForbidden />;
  const { dashboard, usage, outcome }: Loaded =
    auth.kind === 'allowed'
      ? await load(auth.env)
      : { dashboard: null, usage: null, outcome: 'error' };
  if (auth.kind === 'allowed') {
    recordRequest(auth.env, {
      endpoint: 'staff_dashboard',
      outcome,
      status: dashboard ? 200 : 503,
      requestBytes: 0,
      responseBytes: -1,
      totalMs: Date.now() - started,
      usage,
      d1Failed: outcome === 'failed',
    });
  }

  return (
    <>
      <StaffTitle>集計</StaffTitle>
      <StaffNav selected="dashboard" />
      {dashboard ? (
        <StaffDashboardView dashboard={dashboard} />
      ) : (
        <StaffDashboardError />
      )}
    </>
  );
}
