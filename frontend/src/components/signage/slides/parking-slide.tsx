/* eslint-disable @next/next/no-img-element -- CMS が幅960へ縮小済みの WebP を返すため最適化不要 */
import { BADGE } from '@/components/parking-row';
import { formatEventDayTime } from '@/lib/event-day';
import { isImageStale, type ParkingResponse } from '@/lib/parking';
import { SignageHeadingChip } from '../signage-heading-chip';

// 見出しチップの下端 (76) から画面下端までの中央に、画像の有無に関わらずカード群を置く。
// 上下 26 は見出しとの余白で、溢れたときは auto マージンが 0 になり上詰めになる
// 画像ありが 1 枚でもあれば、行をまたいで全カードを 356 に揃える。揃えないと行ごとに高さが変わる
const CARD_MIN_H = { image: 'min-h-[356px]', plain: 'min-h-[250px]' };

export function ParkingSlide({
  parking,
  now,
}: {
  readonly parking: ParkingResponse;
  readonly now: Date;
}) {
  const lots = parking.lots.flatMap((l) =>
    l.status ? [{ ...l, status: l.status }] : [],
  );
  const anyImage = lots.some((l) => l.image);
  return (
    <div className="relative h-[864px] w-[1536px] overflow-hidden rounded-[16px] bg-white">
      <SignageHeadingChip icon="local_parking" label="駐車場の空き状況" />
      <div className="absolute inset-x-6 top-[76px] bottom-0 flex flex-col py-[26px]">
        <ul className="my-auto grid grid-cols-[732px_732px] gap-6">
          {lots.map((lot) => {
            return (
              <li
                key={lot.id}
                className={`flex items-start gap-6 rounded-[16px] border border-gray-200 p-8 ${anyImage ? CARD_MIN_H.image : CARD_MIN_H.plain}`}
              >
                <div className="flex h-[184px] min-w-px flex-1 flex-col gap-4">
                  <p className="min-h-px flex-1 font-display text-[64px] leading-none font-extrabold text-text">
                    {lot.name}
                  </p>
                  <div className="flex flex-col gap-2">
                    <div
                      className={`flex h-[72px] w-[160px] items-center justify-center rounded-[8px] text-[32px] leading-none font-bold ${BADGE[lot.status].style}`}
                    >
                      {BADGE[lot.status].label}
                    </div>
                    {lot.updatedAt && (
                      <p className="text-[24px] leading-none text-gray-600">
                        {formatEventDayTime(lot.updatedAt)} 更新
                      </p>
                    )}
                  </div>
                </div>
                {lot.image && (
                  <div className="flex w-[312px] shrink-0 flex-col gap-2">
                    <div className="h-[234px] w-[312px] rounded-[8px]">
                      <img
                        alt=""
                        src={lot.image.url}
                        className="size-full rounded-[8px] object-cover"
                      />
                    </div>
                    {isImageStale(lot.image.capturedAt, now) ? (
                      <div className="flex gap-1 text-[24px] leading-none">
                        <span
                          aria-hidden="true"
                          className="material-symbols-sharp text-warning"
                          style={{ fontSize: 24 }}
                        >
                          history
                        </span>
                        <p className="min-w-px flex-1 text-text">
                          {formatEventDayTime(lot.image.capturedAt)}{' '}
                          撮影・古い画像の
                          <br />
                          可能性があります
                        </p>
                      </div>
                    ) : (
                      <p className="text-[24px] leading-none text-gray-600">
                        {formatEventDayTime(lot.image.capturedAt)} 撮影
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
