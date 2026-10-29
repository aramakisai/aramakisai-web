/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { SponsorRow } from '@/lib/signage';
import {
  SPONSOR_AREA_TOP,
  SPONSOR_PAGE_HEIGHT,
} from '@/lib/signage-sponsor-area';
import { SignageHeadingChip } from '../signage-heading-chip';

const LOGO_WIDTH = {
  planA: 'w-[440px]',
  planB: 'w-[324px]',
  planC: 'w-[208px]',
} as const;

const LOGO_HEIGHT = {
  planA: 'h-[200px]',
  planB: 'h-[144px]',
  planC: 'h-[96px]',
} as const;

export function SponsorsSlide({
  rows,
}: {
  readonly rows: readonly SponsorRow[];
}) {
  return (
    <div className="relative h-[864px] w-[1536px] overflow-clip rounded-2xl bg-white">
      <SignageHeadingChip icon="handshake" label="ご協賛いただいた皆さま" />
      <div
        className="absolute left-[84px] flex w-[1368px] flex-col justify-center"
        style={{ top: SPONSOR_AREA_TOP, height: SPONSOR_PAGE_HEIGHT }}
      >
        {rows.map((row, i) => (
          <ul
            key={`${row.kind}-${row.items[0]?.id ?? i}`}
            className={`flex gap-6 ${row.kind === 'names' ? 'justify-start' : 'justify-center'} ${i > 0 ? 'mt-6' : ''}`}
          >
            {row.items.map((s) =>
              row.kind === 'logo' ? (
                <li
                  key={s.id}
                  className={`flex flex-col items-center gap-2 ${LOGO_WIDTH[row.tier]}`}
                >
                  <div
                    className={`flex w-full items-center justify-center ${LOGO_HEIGHT[row.tier]}`}
                  >
                    <img
                      src={toAssetUrl(s.logoId, 960) ?? ''}
                      alt={s.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="w-full truncate text-center text-[24px] leading-none text-text">
                    {s.name}
                  </p>
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
