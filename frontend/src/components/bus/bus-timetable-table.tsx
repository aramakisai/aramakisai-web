import {
  departuresOn,
  type BusScheduledDeparture,
  type BusTimetableFile,
} from '@/lib/bus-timetable';
import { formatEventDayLabel, toJstDateKey } from '@/lib/event-day';
import type { EventDay } from '@/lib/home-page-types';

export interface BusTimetableTableProps {
  readonly file: BusTimetableFile;
  readonly eventDays: readonly EventDay[];
}

interface Cell {
  readonly minute: string;
  readonly symbol: string;
  readonly fromCampus: boolean;
}

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18];
const MIN_COLUMNS = 3;
// 行先が前橋駅のほか、けやきウォーク前橋行きなども前橋駅を通るので、記号は経由だけで決める
const NON_MARKER_VIA = new Set(['前橋駅', '群馬大学荒牧']);
const VIA_MARKERS: Readonly<Record<string, string>> = {
  '南橘団地・群大病院': '◯',
  群大病院: '☆',
  南橘団地: '△',
};

function viaSymbol(via: string | null): string {
  if (!via) return '';
  const rest = via
    .split('・')
    .filter((p) => !NON_MARKER_VIA.has(p))
    .join('・');
  return VIA_MARKERS[rest] ?? '';
}

// 1 便を 1 回だけ載せる。荒牧に停まる便は荒牧の時刻、それ以外は教習所前の時刻
function hourlyCells(
  departures: readonly BusScheduledDeparture[],
): Map<number, Cell[]> {
  const byTrip = new Map<string, BusScheduledDeparture[]>();
  for (const d of departures) {
    if (d.direction !== 'maebashi') continue;
    byTrip.set(d.tripId, [...(byTrip.get(d.tripId) ?? []), d]);
  }
  const rows = new Map<number, Cell[]>();
  for (const stops of byTrip.values()) {
    const campus = stops.find((s) => s.stop === 'gunma_univ_aramaki');
    const d = campus ?? stops[0];
    const [h, m] = d.time.split(':');
    const hour = Number(h);
    if (!HOURS.includes(hour)) continue;
    rows.set(hour, [
      ...(rows.get(hour) ?? []),
      { minute: m, symbol: viaSymbol(d.via), fromCampus: !!campus },
    ]);
  }
  for (const cells of rows.values()) {
    cells.sort((a, b) => a.minute.localeCompare(b.minute));
  }
  return rows;
}

const CELL = 'border-b border-r border-gray-200 px-4 py-3 text-left align-top';

function Table({ rows }: { rows: Map<number, Cell[]> }) {
  const columns = Math.max(
    MIN_COLUMNS,
    ...[...rows.values()].map((c) => c.length),
  );
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 border-l border-t border-gray-200 text-[16px] leading-[1.8] text-text">
      <colgroup>
        <col className="w-14 md:w-24" />
      </colgroup>
      <thead>
        <tr>
          <th className={`${CELL} bg-gray-100 font-bold`}>時</th>
          <th colSpan={columns} className={`${CELL} bg-gray-100 font-bold`}>
            分
          </th>
        </tr>
      </thead>
      <tbody>
        {HOURS.map((hour) => {
          const cells = rows.get(hour) ?? [];
          return (
            <tr key={hour}>
              <td className={CELL}>{hour}</td>
              {Array.from({ length: columns }, (_, i) => {
                const c = cells[i];
                return (
                  <td
                    key={i}
                    className={`${CELL} ${c?.fromCampus ? 'font-bold underline decoration-from-font' : ''}`}
                  >
                    {c ? `${c.symbol}${c.minute}` : ''}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function BusTimetableTable({ file, eventDays }: BusTimetableTableProps) {
  // 発車が同じ開催日は 1 つの表にまとめる
  const groups = new Map<
    string,
    { labels: string[]; rows: Map<number, Cell[]> }
  >();
  for (const day of eventDays) {
    const rows = hourlyCells(departuresOn(file, toJstDateKey(day.startAt)));
    if (rows.size === 0) continue;
    const key = JSON.stringify([...rows]);
    const g = groups.get(key) ?? { labels: [], rows };
    g.labels.push(formatEventDayLabel(day.startAt));
    groups.set(key, g);
  }
  if (groups.size === 0) return null;

  return (
    <section
      data-testid="bus-timetable"
      className="flex flex-col gap-6 text-text"
    >
      {[...groups.values()].map((g, i) => {
        const date = (
          <p className="text-[16px] font-bold leading-[1.8]">
            {g.labels.join('・')}
          </p>
        );
        return (
          <div key={g.labels.join()} className="flex flex-col gap-6">
            {i === 0 ? (
              <div className="flex flex-col gap-4">
                <h2 className="py-0 text-[25px] leading-[1.25]">
                  前橋駅行バス時刻表
                </h2>
                {date}
              </div>
            ) : (
              date
            )}
            <Table rows={g.rows} />
            <div className="text-[14px] leading-[1.8]">
              <p>下線太字は群馬大学荒牧発、それ以外は前橋自動車教習所前発</p>
              <p>◯ 南橘団地・群大病院経由</p>
              <p>☆ 群大病院経由</p>
              <p>△ 南橘団地経由</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
