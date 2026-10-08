/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { SponsorRow } from '@/lib/signage';
import { SignageHeadingChip } from '../signage-heading-chip';

const LOGO_FRAME = {
  planA: 'h-[200px] w-[440px]',
  planB: 'h-[144px] w-[324px]',
  planC: 'h-[96px] w-[208px]',
} as const;

// 行間: 同じプラン内は24px、プランが変わるときは32px (paginateSponsors の行高計算と一致させる)
function rowGap(prev: SponsorRow | undefined, row: SponsorRow): string {
  if (!prev) return '';
  const same =
    prev.kind === row.kind &&
    (row.kind === 'names' || (prev.kind === 'logo' && prev.tier === row.tier));
  return same ? 'mt-6' : 'mt-8';
}

export function SponsorsSlide({
  rows,
}: {
  readonly rows: readonly SponsorRow[];
}) {
  return (
    <div className="relative h-[864px] w-[1536px] overflow-clip rounded-2xl bg-white">
      <SignageHeadingChip icon="handshake" label="ご協賛いただいた皆さま" />
      <div className="absolute top-[106px] left-[84px] flex flex-col">
        {rows.map((row, i) => (
          <ul
            key={`${row.kind}-${row.items[0]?.id ?? i}`}
            className={`flex justify-center gap-6 ${rowGap(rows[i - 1], row)}`}
          >
            {row.items.map((s) =>
              row.kind === 'logo' ? (
                <li key={s.id} className="flex flex-col items-center gap-2">
                  <div
                    className={`flex items-center justify-center bg-gray-200 ${LOGO_FRAME[row.tier]}`}
                  >
                    <img
                      src={toAssetUrl(s.logoId, 960) ?? ''}
                      alt={s.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[24px] leading-none text-text">{s.name}</p>
                </li>
              ) : (
                <li
                  key={s.id}
                  className="w-[324px] truncate text-center text-[24px] leading-none text-text"
                >
                  {s.name}
                </li>
              ),
            )}
          </ul>
        ))}
      </div>
    </div>
  );
}
