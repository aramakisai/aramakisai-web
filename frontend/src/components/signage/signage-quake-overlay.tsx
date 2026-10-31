import {
  pageCount,
  type SignageSlide,
  type SignageSnapshot,
} from '@/lib/signage';
import {
  QUAKE_DEFAULT_COPY,
  type SignageQuakeObservation,
  type SignageQuakePayload,
  type SignageQuakeSource,
  type SignageQuakeStage,
} from '@/lib/signage-quake';
import { SignageIcon } from './signage-parts';
import { SignageMain, type SlideRenderers } from './signage-main';

type ActiveQuake = Extract<SignageQuakePayload, { active: true }>;

export interface SignageQuakeOverlayProps {
  readonly quake: ActiveQuake;
  readonly slide: SignageSlide | null;
  readonly snapshot: SignageSnapshot | null;
  readonly now: Date;
  readonly renderers: SlideRenderers;
}

const NOTE_LINES = [
  '気象庁が発表した情報を転送した参考情報です。',
  '公式の警報ではありません',
] as const;

// 横長の帯は幅264pxに収めるため、Figma の改行位置を保つ
const STAGE_LINES: Readonly<
  Record<
    SignageQuakeStage,
    { readonly band: readonly string[]; readonly info: readonly string[] }
  >
> = {
  warning: {
    band: ['身を', '守って', 'ください'],
    info: ['身を守って', 'ください'],
  },
  calm: {
    band: ['揺れは', '収まり', 'ました'],
    info: ['揺れは', '収まりました'],
  },
  evacuate: {
    band: ['指示を', '待って', 'ください'],
    info: ['指示を待って', 'ください'],
  },
  cancelled: { band: ['取り', '消され', 'ました'], info: ['取り消されました'] },
};

const GROUND: Readonly<Record<SignageQuakeStage, string>> = {
  warning: 'bg-warning',
  calm: 'bg-bansai-sage',
  evacuate: 'bg-warning',
  cancelled: 'bg-gray-200',
};

const SOURCE_LABEL: Readonly<Record<SignageQuakeSource, string>> = {
  p2p: 'P2P地震情報',
  wolfx: 'Wolfx',
};

/** 受信した "YYYY/MM/DD HH:mm:ss" を "M/D HH:mm頃" にする。形が違えば受信値のまま */
function formatOrigin(raw: string): string {
  const m = /^\d{4}\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/.exec(raw);
  return m ? `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}頃` : raw;
}

function intensityRow(o: SignageQuakeObservation) {
  if (o.maebashiIntensity !== null)
    return { label: '前橋市', value: o.maebashiIntensity };
  if (o.source === 'p2p')
    return { label: '前橋市', value: '前橋市の観測点の発表なし' };
  return o.maxIntensity === null
    ? null
    : { label: '最大震度', value: o.maxIntensity };
}

function sourceOf(quake: ActiveQuake): SignageQuakeSource {
  const observed =
    (quake.stage === 'calm' || quake.stage === 'evacuate') && quake.observation;
  return observed ? observed.source : quake.source;
}

function StageName({
  lines,
  className,
}: {
  readonly lines: readonly string[];
  readonly className: string;
}) {
  return (
    <div className={`font-display font-black leading-[1.2] ${className}`}>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

function Heading({ className }: { readonly className: string }) {
  return (
    <div
      className={`flex items-center font-display leading-none whitespace-nowrap ${className}`}
    >
      <SignageIcon name="warning" />
      <span className="font-black">緊急地震速報</span>
    </div>
  );
}

function TrainingMark({ className }: { readonly className: string }) {
  return (
    <div
      data-quake-training
      className={`flex items-center justify-center rounded-[8px] bg-text px-6 py-4 ${className}`}
    >
      <span className="font-display text-[96px] leading-none font-black whitespace-nowrap text-background">
        訓練
      </span>
    </div>
  );
}

function Values({
  observation,
}: {
  readonly observation: SignageQuakeObservation;
}) {
  const row = intensityRow(observation);
  const small = (row?.value.length ?? 0) > 4;
  return (
    <div className="flex w-full flex-col gap-4 leading-none">
      <div className="flex flex-col gap-1 font-display font-bold">
        <p className="text-[24px]">発生</p>
        <p className="text-[36px]">{formatOrigin(observation.originTime)}</p>
      </div>
      <div className="flex flex-col gap-1 font-display font-bold">
        <p className="text-[24px]">震源</p>
        <p className="text-[36px] whitespace-normal">
          {observation.hypocenter}
        </p>
      </div>
      {row && (
        <div className="flex flex-col gap-1">
          <p className="font-display text-[24px] font-bold">{row.label}</p>
          <p
            className={`font-display font-black ${small ? 'text-[36px] leading-[1.2]' : 'text-[64px]'}`}
          >
            {row.value}
          </p>
        </div>
      )}
    </div>
  );
}

function Source({ source }: { readonly source: SignageQuakeSource }) {
  return (
    <p className="font-display text-[24px] leading-none font-bold whitespace-nowrap">
      情報源 {SOURCE_LABEL[source]}
    </p>
  );
}

function Note({ className }: { readonly className: string }) {
  return (
    <div
      data-quake-note
      className={`flex flex-col justify-center rounded-[16px] bg-text px-6 font-display text-[44px] leading-[1.2] font-bold text-background ${className}`}
    >
      {NOTE_LINES.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

function DefaultCopy({ stage }: { readonly stage: SignageQuakeStage }) {
  const copy = QUAKE_DEFAULT_COPY[stage];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-16 text-center text-text">
      <p className="w-full font-display text-[96px] leading-[1.1] font-black">
        {copy.heading}
      </p>
      <div className="flex flex-col gap-2 font-display text-[40px] leading-[1.3] font-bold">
        {copy.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </div>
  );
}

/** 全画面の速報表示。下の巡回・テロップ・バス案内は覆い、描画は続ける */
export function SignageQuakeOverlay({
  quake,
  slide,
  snapshot,
  now,
  renderers,
}: SignageQuakeOverlayProps) {
  const { stage } = quake;
  const lines = STAGE_LINES[stage];
  const source = sourceOf(quake);
  const observation =
    (stage === 'calm' || stage === 'evacuate') && quake.observation
      ? quake.observation
      : null;
  const entry =
    slide && snapshot && pageCount(slide, snapshot, now) > 0
      ? { key: `quake:${slide.id}`, slide, page: 0 }
      : null;
  const ground = GROUND[stage];

  return (
    <div data-quake-overlay className="absolute inset-0 bg-background">
      <div
        data-quake-band
        className={`absolute top-6 left-6 flex h-[1032px] w-[312px] flex-col justify-between rounded-[16px] p-6 text-text portrait:hidden ${ground}`}
      >
        <div className="flex flex-col gap-6">
          {quake.training && <TrainingMark className="w-full" />}
          <div className="flex flex-col gap-4">
            <Heading className="gap-2 text-[36px]" />
            <StageName lines={lines.band} className="text-[64px]" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {observation && <Values observation={observation} />}
          <Source source={source} />
        </div>
      </div>

      <div
        className={`absolute top-6 left-6 hidden h-[176px] w-[1032px] items-center gap-6 rounded-[16px] px-6 py-4 text-text portrait:flex ${ground}`}
      >
        {quake.training && <TrainingMark className="h-full" />}
        <Heading className="gap-4 text-[64px]" />
      </div>

      <div
        data-quake-info
        className={`absolute top-[829px] left-6 hidden h-[923px] w-[1032px] flex-col justify-between rounded-[16px] p-6 text-text portrait:flex ${ground}`}
      >
        <div
          className={`flex flex-1 flex-col gap-12 ${observation ? '' : 'justify-center'}`}
        >
          <StageName lines={lines.info} className="text-[104px]" />
          {observation && <Values observation={observation} />}
        </div>
        <Source source={source} />
      </div>

      {entry ? (
        <SignageMain
          entry={entry}
          snapshot={snapshot}
          now={now}
          renderers={renderers}
          transition={false}
        />
      ) : (
        <div className="signage-main-frame">
          <div className="signage-main">
            <DefaultCopy stage={stage} />
          </div>
        </div>
      )}

      <Note className="absolute top-[912px] left-[360px] h-[144px] w-[1536px] portrait:hidden" />
      <Note className="absolute top-[1776px] left-6 hidden h-[120px] w-[1032px] portrait:flex" />
    </div>
  );
}
