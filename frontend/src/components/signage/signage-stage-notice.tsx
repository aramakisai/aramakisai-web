'use client';

import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { InfRing, ShapeFill } from '@/components/background-shapes';
import { ClockOffsetContext } from '@/lib/signage-time';
import type { StageStartNotice } from '@/lib/signage-stage-notice';
import {
  NOTICE_MAIN_CENTER,
  NOTICE_MOTION,
  NOTICE_SHAPES,
  NOTICE_SMALL_SHAPE_MAX,
  noticeBpm,
  type NoticeShape,
} from '@/lib/signage-stage-notice-shapes';
import { STAGE_BAND_CLASSES } from '../timetable-stage-colors';

const { enter, beat, leave } = NOTICE_MOTION;

interface SignageStageNoticeProps {
  readonly notices: readonly StageStartNotice[];
  /** 補正済み時刻。拍の速さ(残り時間)と位相に使う */
  readonly now: Date;
  readonly leaving: boolean;
}

interface BeatTiming {
  readonly bpm: number;
  /** 端末時計から補正済み時刻への差(ms) */
  readonly offsetMs: number;
}

function Chip({ notice }: { readonly notice: StageStartNotice }) {
  return (
    <div
      data-notice-chip=""
      className={`flex h-[52px] shrink-0 items-center rounded-[4px] px-4 py-2 font-sans text-[36px] leading-none font-bold whitespace-nowrap text-text ${STAGE_BAND_CLASSES[notice.colorIndex % STAGE_BAND_CLASSES.length]}`}
    >
      {notice.stageName}
    </div>
  );
}

const LABEL = 'font-display text-[36px] leading-[1.4] font-bold text-text';

function NoticeText({
  notices,
}: {
  readonly notices: readonly StageStartNotice[];
}) {
  const single = notices.length === 1 ? notices[0] : null;
  return (
    <>
      {single ? <Chip notice={single} /> : null}
      <p className={LABEL}>まもなく</p>
      {single ? (
        <p className="line-clamp-2 w-full font-display text-[96px] leading-[1.1] font-black break-words text-text">
          {single.name}
        </p>
      ) : (
        <div className="flex w-full flex-col gap-6">
          {notices.map((n) => (
            <div
              key={n.performanceId}
              data-notice-row=""
              className="flex h-[62px] items-center gap-6"
            >
              <Chip notice={n} />
              <p className="min-w-0 flex-1 truncate font-display text-[56px] leading-[1.1] font-black text-text">
                {n.name}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className={LABEL}>が始まります</p>
    </>
  );
}

function awayFromCenter(cx: number, cy: number, distancePx: number) {
  const vx = cx - NOTICE_MAIN_CENTER.x;
  const vy = cy - NOTICE_MAIN_CENTER.y;
  const n = Math.hypot(vx, vy) || 1;
  return { dx: (vx / n) * distancePx, dy: (vy / n) * distancePx };
}

const isSmall = (s: NoticeShape) =>
  (s.kind === 'ring' ? s.diameter : s.size) <= NOTICE_SMALL_SHAPE_MAX;

/** 動かす要素の入場・退場の animation。translate だけを使い、内側の拍(transform)と合成させない */
function moveAnimation(
  leaving: boolean,
  from: { dx: number; dy: number },
  to: { dx: number; dy: number },
  durEnter: number,
  durLeave: number,
  delayEnter = 0,
  settled = false,
): CSSProperties {
  if (settled && !leaving) return {};
  return leaving
    ? ({
        '--ex': `${to.dx}px`,
        '--ey': `${to.dy}px`,
        animation: `notice-leave ${durLeave}s ${leave.easing} forwards`,
      } as CSSProperties)
    : ({
        '--dx': `${from.dx}px`,
        '--dy': `${from.dy}px`,
        animation: `notice-gather ${durEnter}s ${enter.easing} ${delayEnter}s backwards`,
      } as CSSProperties);
}

function isGatherEnd(e: React.AnimationEvent) {
  return e.target === e.currentTarget && e.animationName === 'notice-gather';
}

/**
 * 位置(中心)・回転・拍の各 transform を入れ子の別要素に分ける。
 * 入場(translate)と拍(scale)を同じ要素に置くと、拍の開始遅延に入場時間を足すことになり壁時計に揃わない
 */
function ShapeView({
  shape,
  leaving,
  timing,
  settled,
}: {
  readonly shape: NoticeShape;
  readonly leaving: boolean;
  readonly timing: BeatTiming;
  readonly settled: boolean;
}) {
  const [entered, setEntered] = useState(settled);
  const small = isSmall(shape);
  const dist = small ? enter.small : enter.large;
  const leaveSec = small ? leave.small.durationSec : leave.large.durationSec;
  const out = awayFromCenter(shape.cx, shape.cy, leave.distancePx);
  const periodSec = 60 / timing.bpm;
  const beatRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  // 位相は CSS の負の delay でなく Animation.startTime(タイムライン基準の絶対値)で壁時計に合わせる。
  // 初回フレームや画像読み込みの遅れがあっても全層・全端末で同じ位相になる。bpm が変われば取り直す
  useLayoutEffect(() => {
    if (!entered) return;
    const align = (el: HTMLElement | null, name: string, periodMs: number) => {
      const anim = el
        ?.getAnimations?.()
        .find((a) => (a as CSSAnimation).animationName === name);
      const t = document.timeline?.currentTime;
      if (anim && t != null)
        anim.startTime =
          Number(t) -
          ((((Date.now() + timing.offsetMs) % periodMs) + periodMs) % periodMs);
    };
    align(beatRef.current, 'notice-beat', 1000 * periodSec);
    align(spinRef.current, 'notice-spin', 1000 * periodSec * beat.rotateBeats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, timing.bpm]);
  const beatStyle: CSSProperties = entered
    ? { animation: `notice-beat ${periodSec}s ${beat.easing} infinite` }
    : {};

  if (shape.kind === 'ring') {
    const D = shape.diameter;
    const spinStyle: CSSProperties = entered
      ? {
          animation: `notice-spin ${periodSec * beat.rotateBeats}s linear infinite`,
        }
      : {};
    return (
      <div
        data-notice-shape=""
        className="absolute"
        style={{
          left: shape.cx,
          top: shape.cy,
          ...(leaving ? moveAnimation(true, out, out, 0, leaveSec) : undefined),
        }}
      >
        <div style={{ rotate: `${shape.rot}deg` }}>
          <div data-notice-spin="" ref={spinRef} style={spinStyle}>
            <div data-notice-beat="" ref={beatRef} style={beatStyle}>
              <div
                className="absolute"
                style={{
                  left: -0.87 * D,
                  top: -D / 2,
                  width: 1.74 * D,
                  height: D,
                }}
              >
                {([0, 1] as const).map((i) => {
                  const side = i === 0 ? -1 : 1;
                  return (
                    <div
                      key={i}
                      className="absolute inset-0"
                      style={moveAnimation(
                        leaving,
                        { dx: side * enter.ring.splitPx, dy: 0 },
                        { dx: side * leave.ringSplitPx, dy: 0 },
                        dist.durationSec,
                        leaveSec,
                        i === 1 ? enter.ring.rightDelaySec : 0,
                        settled,
                      )}
                      onAnimationEnd={
                        i === 1
                          ? (e) => isGatherEnd(e) && setEntered(true)
                          : undefined
                      }
                    >
                      <InfRing index={i} diameter={D} color={shape.colors[i]} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-notice-shape=""
      className="absolute"
      style={{
        left: shape.cx,
        top: shape.cy,
        ...moveAnimation(
          leaving,
          awayFromCenter(shape.cx, shape.cy, dist.distancePx),
          out,
          dist.durationSec,
          leaveSec,
          0,
          settled,
        ),
      }}
      onAnimationEnd={(e) => isGatherEnd(e) && setEntered(true)}
    >
      <div style={{ rotate: `${shape.rot}deg` }}>
        <div data-notice-beat="" ref={beatRef} style={beatStyle}>
          <div
            className="absolute"
            style={{
              left: -shape.size / 2,
              top: -shape.size / 2,
              width: shape.size,
              height: shape.size,
            }}
          >
            <ShapeFill
              kind={shape.kind}
              texture={shape.texture}
              pos={shape.pos}
              rot={shape.texRot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 背景図形の層。bpm は呼び出し側が残り時間から決め、位相は bpm が変わったときだけ取り直す */
export function NoticeShapeLayer({
  bpm,
  leaving,
  settled = false,
}: {
  readonly bpm: number;
  readonly leaving: boolean;
  /** 前のスライドから図形が続いているとき、入場せず拍の最中から描く */
  readonly settled?: boolean;
}) {
  const offsetMs = useContext(ClockOffsetContext);
  const timing = useMemo<BeatTiming>(
    () => ({ bpm, offsetMs }),
    [bpm, offsetMs],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {NOTICE_SHAPES.map((shape, i) => (
        <ShapeView
          key={i}
          shape={shape}
          leaving={leaving}
          timing={timing}
          settled={settled}
        />
      ))}
    </div>
  );
}

export function SignageStageNotice({
  notices,
  now,
  leaving,
}: SignageStageNoticeProps) {
  const earliest = Math.min(...notices.map((n) => Date.parse(n.startAt)));
  const bpm = noticeBpm((earliest - now.getTime()) / 1000);
  const fade = (sec: number, delay = 0): CSSProperties => ({
    animation: leaving
      ? `fade-out ${sec}s ease-in ${delay}s forwards`
      : `fade-in ${enter.fadeSec}s ease-out both`,
  });

  return (
    <div
      data-stage-notice=""
      data-leaving={leaving}
      className="absolute inset-0 overflow-hidden"
    >
      <div
        data-notice-backdrop=""
        className="absolute inset-0 bg-white"
        style={fade(leave.backdrop.durationSec, leave.backdrop.delaySec)}
      />
      <NoticeShapeLayer bpm={bpm} leaving={leaving} />
      <div
        data-notice-text=""
        className="absolute inset-0 flex flex-col items-start justify-center gap-6 p-16 [word-break:auto-phrase]"
        style={fade(leave.textFadeSec)}
      >
        <NoticeText notices={notices} />
      </div>
    </div>
  );
}
