import type { VisitorSummary } from '@/lib/stamp-aggregate';
import type { ExchangeRecord } from '@/lib/stamp-db';
import { ExchangeActions } from './exchange-actions';
import { Section, Tile } from './staff-dashboard-view';

export function StaffVisitorView({
  visitorId,
  summary,
  exchange,
  eligible,
}: {
  readonly visitorId: string;
  readonly summary: VisitorSummary;
  readonly exchange: ExchangeRecord | null;
  readonly eligible: boolean;
}) {
  return (
    <>
      <p className="text-sm leading-[1.4] text-gray-600">
        ID {visitorId.slice(0, 8)}
      </p>
      <Tile label="スタンプ" value={summary.stampCount} unit="件" />
      <Section title="エリア別">
        <div className="flex flex-col gap-2">
          {summary.byArea.map((a) => (
            <div
              key={a.areaId ?? 'unknown'}
              className="flex items-center justify-between border-b border-gray-200 py-4 text-text"
            >
              <p className="text-base leading-[1.5] font-bold">{a.areaName}</p>
              <p className="text-sm leading-[1.4]">{a.collected}件</p>
            </div>
          ))}
        </div>
      </Section>
      <ExchangeActions
        visitorId={visitorId}
        initialExchange={exchange}
        eligible={eligible}
      />
    </>
  );
}
