import { CrossFade } from '../cross-fade';
import { formatEventDayTime } from '@/lib/event-day';
import type { EventDay } from '@/lib/home-page-types';
import { eventDayIndex } from '@/lib/signage';
import { formatSignageDate } from '@/lib/signage-clock';
import type { TimetablePerformance } from '@/lib/timetable';
import { STAGE_BAND_CLASSES } from '../timetable-stage-colors';

export function SignageIcon({ name }: { readonly name: string }) {
  return (
    <span
      aria-hidden="true"
      className="material-symbols-sharp font-light"
      style={{ fontSize: 'inherit' }}
    >
      {name}
    </span>
  );
}

/** 開催日以外はDAYチップを出さず日付だけ */
export function SignageDayDate({
  eventDays,
  now,
  baseClass = '',
}: {
  readonly eventDays: readonly EventDay[];
  readonly now: Date;
  /** CrossFade の各レイヤーの地。省くと透明になり背景図形が透けるため、旧レイヤーは fade-out で消す。不透明な面の上に置くときだけ指定する */
  readonly baseClass?: string;
}) {
  const day = eventDayIndex(eventDays, now);
  const date = formatSignageDate(now);
  return (
    <CrossFade
      transitionKey={date}
      fadePrevious={baseClass === ''}
      layerClassName={`flex items-center gap-3 ${baseClass} font-display text-[28px] leading-none font-bold text-text`}
    >
      {day !== null && (
        <span className="whitespace-nowrap rounded-[8px] bg-primary px-4 py-2">
          DAY {day}
        </span>
      )}
      <span className="whitespace-nowrap">{date}</span>
    </CrossFade>
  );
}

export function SignageStageChip({
  colorIndex,
  name,
}: {
  readonly colorIndex: number;
  readonly name: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[4px] px-3 py-1 text-[24px] leading-none font-bold text-text ${STAGE_BAND_CLASSES[colorIndex % STAGE_BAND_CLASSES.length]}`}
    >
      {name}
    </span>
  );
}

export function formatPerformanceRange(p: TimetablePerformance): string {
  return `${formatEventDayTime(p.slot.startAt)}〜${formatEventDayTime(p.slot.endAt)}`;
}

export function SignageOfficialSite({
  labelClass,
  qrClass,
  label = '▼公式サイト',
  qrSrc = '/images/qr-aramakisai.svg',
}: {
  readonly labelClass: string;
  readonly qrClass: string;
  readonly label?: string;
  readonly qrSrc?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p
        className={`font-display leading-none font-bold whitespace-nowrap text-text ${labelClass}`}
      >
        {label}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={qrSrc} className={qrClass} />
    </div>
  );
}

export function SignageLogo({ className }: { readonly className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="荒牧祭2026"
      src="/images/logo-2026.webp"
      className={`object-contain ${className}`}
    />
  );
}
