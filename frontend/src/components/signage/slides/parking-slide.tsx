import { BADGE } from '@/components/parking-row';
import { formatEventDayTime } from '@/lib/event-day';
import type { ParkingResponse } from '@/lib/parking';
import { SignageHeadingChip } from '../signage-heading-chip';

const CARD_H = 170;
const GAP = 24;
const CENTER_Y = 458;
const MIN_TOP = 92;

export function ParkingSlide({
  parking,
}: {
  readonly parking: ParkingResponse;
}) {
  const lots = parking.lots.flatMap((l) =>
    l.status ? [{ ...l, status: l.status }] : [],
  );
  const rows = Math.ceil(lots.length / 2);
  const height = rows * CARD_H + Math.max(0, rows - 1) * GAP;
  // 行数が少ないうちは Figma の位置(2行で上端276)に揃え、増えたら見出しの下から詰める
  const top = Math.max(MIN_TOP, CENTER_Y - height / 2);
  return (
    <div className="relative h-[864px] w-[1536px] overflow-hidden rounded-[16px] bg-white">
      <SignageHeadingChip icon="local_parking" label="駐車場の空き状況" />
      <ul
        className="absolute left-6 grid grid-cols-[732px_732px] gap-6"
        style={{ top }}
      >
        {lots.map((lot) => (
          <li
            key={lot.id}
            className="flex items-center rounded-[16px] border border-gray-200 p-8"
          >
            <p className="min-w-px flex-1 font-display text-[64px] leading-none font-extrabold text-text">
              {lot.name}
            </p>
            <div className="flex flex-col items-end gap-2">
              <div
                className={`flex h-[72px] w-[160px] items-center justify-center rounded-[8px] font-display text-[36px] leading-none font-bold ${BADGE[lot.status].style}`}
              >
                {BADGE[lot.status].label}
              </div>
              {lot.updatedAt && (
                <p className="font-display text-[24px] leading-none text-gray-600">
                  {formatEventDayTime(lot.updatedAt)} 更新
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
