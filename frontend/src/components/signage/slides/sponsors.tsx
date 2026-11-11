/* eslint-disable @next/next/no-img-element */
import { Fragment, useContext } from 'react';
import { toCardImageUrl } from '@/lib/cms-asset-url';
import type { SponsorRow } from '@/lib/signage';
import {
  fallbackMeasure,
  layoutSponsorName,
  SPONSOR_NAME_LINE_PX,
} from '@/lib/signage-sponsor-name';
import { SponsorMeasureContext } from '@/lib/use-sponsor-measure';
import {
  SPONSOR_AREA_TOP,
  SPONSOR_PAGE_HEIGHT,
} from '@/lib/signage-sponsor-area';
import { SignageHeadingChip } from '../signage-heading-chip';

const FRAME = { planA: 440, planB: 324, planC: 208, names: 324 } as const;

const LOGO_HEIGHT = {
  planA: 200,
  planB: 144,
  planC: 96,
} as const;

function SponsorName({
  name,
  frame,
  className = '',
}: {
  readonly name: string;
  readonly frame: number;
  readonly className?: string;
}) {
  const measure = useContext(SponsorMeasureContext) ?? fallbackMeasure;
  const { phrases, scale, lines } = layoutSponsorName(name, frame, measure);
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: frame, height: lines * SPONSOR_NAME_LINE_PX }}
    >
      <p
        className="absolute top-0 left-0 text-center text-[24px] leading-[1.25] text-text [text-wrap:balance]"
        style={{
          width: frame / scale,
          transform: scale < 1 ? `scaleX(${scale})` : undefined,
          transformOrigin: 'top left',
        }}
      >
        {phrases.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <wbr />}
            <span className="whitespace-nowrap">{p}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}

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
            className={`flex items-start gap-6 ${row.kind === 'names' ? 'justify-start' : 'justify-center'} ${i > 0 ? 'mt-6' : ''}`}
          >
            {row.items.map((s) =>
              row.kind === 'logo' ? (
                <li
                  key={s.id}
                  className="flex flex-col items-center gap-2"
                  style={{ width: FRAME[row.tier] }}
                >
                  {s.logoId === null ? (
                    <div
                      className="flex w-full items-center justify-center"
                      style={{ minHeight: LOGO_HEIGHT[row.tier] }}
                    >
                      <SponsorName name={s.name} frame={FRAME[row.tier]} />
                    </div>
                  ) : (
                    <>
                      <div
                        className="flex w-full items-center justify-center"
                        style={{ height: LOGO_HEIGHT[row.tier] }}
                      >
                        <img
                          src={(s.logo ? toCardImageUrl(s.logo) : null) ?? ''}
                          alt={s.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <SponsorName name={s.name} frame={FRAME[row.tier]} />
                    </>
                  )}
                </li>
              ) : (
                <li key={s.id} style={{ width: FRAME.names }}>
                  <SponsorName name={s.name} frame={FRAME.names} />
                </li>
              ),
            )}
          </ul>
        ))}
      </div>
    </div>
  );
}
