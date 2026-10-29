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

async function load(
  env: StampEnv,
): Promise<{ dashboard: Dashboard | null; usage: D1Usage | null }> {
  try {
    const [records, catalog] = await Promise.all([
      createStampRepository(env.STAMP_DB).loadAllRecords(),
      getExhibitionCatalog(),
    ]);
    if (!records.ok) return { dashboard: null, usage: records.usage };
    return {
      dashboard: aggregate(
        toStampTargets(catalog.cards),
        catalog.areas,
        records.value,
      ),
      usage: records.usage,
    };
  } catch {
    return { dashboard: null, usage: null };
  }
}

export default async function StaffDashboardPage() {
  const started = Date.now();
  const auth = await authorizeStaffPage('/staff');
  if (auth.kind === 'forbidden') return <StaffForbidden />;
  const { dashboard, usage } =
    auth.kind === 'allowed'
      ? await load(auth.env)
      : { dashboard: null, usage: null };
  if (auth.kind === 'allowed') {
    recordRequest(auth.env, {
      endpoint: 'staff_dashboard',
      outcome: dashboard ? 'ok' : 'failed',
      status: dashboard ? 200 : 503,
      requestBytes: 0,
      responseBytes: 0,
      totalMs: Date.now() - started,
      usage,
      d1Failed: usage === null || dashboard === null,
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
