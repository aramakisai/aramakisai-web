import Link from 'next/link';
import { MaterialIcon } from '@/components/icons';
import type { Dashboard } from '@/lib/stamp-aggregate';
import { StaffSectionTitle } from './staff-heading';
import { StaffTargetFilter } from './staff-target-filter';
import { StampDistributionChart } from './stamp-distribution-chart';

const ROW = 'border-b border-gray-200 py-4';

export function Tile({
  label,
  value,
  unit = '',
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-gray-200 p-4">
      <p className="text-sm leading-[1.4] text-gray-600">{label}</p>
      <p className="text-[32px] leading-[1.25] font-bold text-text">
        {value.toLocaleString('ja-JP')}
        {unit}
      </p>
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <StaffSectionTitle>{title}</StaffSectionTitle>
      <div>{children}</div>
    </section>
  );
}

export function StaffDashboardView({
  dashboard,
}: {
  readonly dashboard: Dashboard;
}) {
  return (
    <>
      <div className="flex gap-4">
        <Tile label="参加端末" value={dashboard.participantCount} />
        <Tile label="交換済み" value={dashboard.activeExchangeCount} />
      </div>

      <Section title="エリア別">
        {dashboard.areas.map((a) => (
          <div
            key={a.areaId ?? 'unknown'}
            className={`${ROW} flex flex-col gap-2`}
          >
            <div className="flex items-center justify-between gap-2 text-text">
              <p className="text-base leading-[1.5] font-bold">{a.areaName}</p>
              <p className="text-sm leading-[1.4]">
                {a.collected}件
                {a.averagePercent !== null && ` 平均${a.averagePercent}%`}
              </p>
            </div>
            {a.averagePercent !== null && (
              <div
                aria-hidden="true"
                className="h-1 w-full overflow-hidden rounded-full bg-gray-200"
              >
                <div
                  className="h-full rounded-full bg-accent-alt"
                  style={{ width: `${a.averagePercent}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section title="企画別">
        <StaffTargetFilter
          targets={dashboard.targets}
          areas={dashboard.areas}
        />
      </Section>

      <Section title="スタンプ数の分布">
        <StampDistributionChart distribution={dashboard.distribution} />
      </Section>
    </>
  );
}

export function StaffDashboardError() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="flex items-center gap-1 text-sm leading-[1.4] text-text">
        <MaterialIcon name="sync_problem" size={16} className="text-warning" />
        集計を取得できませんでした
      </p>
      <Link
        href="/staff"
        prefetch={false}
        className="rounded-md border border-gray-200 px-4 py-2 text-sm text-text hover-card-shadow hover:bg-background"
      >
        再読み込み
      </Link>
    </div>
  );
}
