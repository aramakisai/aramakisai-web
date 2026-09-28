'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { usePathname } from 'next/navigation';
import { placeBackgroundShapes } from '@/lib/background-shapes/placement';
import { filterForObstacles } from '@/lib/background-shapes/reuse';
import { collectObstacles } from '@/lib/background-shapes/obstacles';
import type {
  Platform,
  PlacedShape,
  PlacementInput,
  RingColor,
  ShapeKind,
  Tier,
  TextureId,
} from '@/lib/background-shapes/types';
import {
  clampDisplacement,
  clampFrameDt,
  collectSectionRects,
  computeEntryOffsets,
  computeRepulsionAccel,
  deriveShapeMotionParams,
  entryDurationMs,
  infRingEntryOffsets,
  isOffscreenVertically,
  isSettled,
  scrollVelocityImpulse,
  stepSpring,
  ENTRY_EASING,
  INTERSECTION_THRESHOLD,
  POINTER_ACTIVE_WINDOW_MS,
  REPULSE_MAX_ACCEL,
  type EntryOffset,
  type SectionRect,
  type ShapeMotionParams,
  type SpringState,
} from '@/lib/background-shapes-motion';
import { LG_BREAKPOINT_PX } from '@/lib/breakpoints';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { MAIN_CONTENT_ID } from './header';

// (site)/layout.tsx の外側コンテナ (position: relative)。装飾レイヤーはこの内側に
// absolute inset-0 で敷くため、コンテナ自身の高さは装飾レイヤーを含まない
// (ヘッダー・BottomNavigation は fixed で本文の流れに参加しない)
export const PAGE_CONTAINER_ID = 'page-container';

const RING_BORDER_CLASS: Record<RingColor, string> = {
  ochre: 'border-bansai-ochre',
  olive: 'border-bansai-olive',
  sage: 'border-bansai-sage',
  salmon: 'border-bansai-salmon',
  rose: 'border-bansai-rose',
  wisteria: 'border-bansai-wisteria',
  aqua: 'border-bansai-aqua',
};

function textureStyle(texture: TextureId): CSSProperties {
  return {
    backgroundImage: `url(/images/textures/bg/${texture}.webp)`,
    backgroundSize: 'cover',
  };
}

// geometry.ts の図形内外判定 (sampleShape) と同じ形を CSS で再現する。roundedSquare の角丸は
// geometry.ts の SDF (半径 s*0.18 の丸め箱) と border-radius が等価なので、
// 正方形の一辺に対する比率 (18%) をそのまま使える。quarterCircle は circle()
// の半径 100% が箱の対角線 (幅=高さの正方形では一辺と等しい) に正規化される
// CSS Shapes の仕様を使うと、半径 s・中心を左上角に置いた扇形に一致する
function ShapeFill({ kind, texture }: { kind: ShapeKind; texture: TextureId }) {
  const style = textureStyle(texture);
  switch (kind) {
    case 'circle':
      return <div className="size-full rounded-full" style={style} />;
    case 'square':
      return <div className="size-full" style={style} />;
    case 'roundedSquare':
      return <div className="size-full rounded-[18%]" style={style} />;
    case 'triangle':
      return (
        <div
          className="size-full"
          style={{ ...style, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
        />
      );
    case 'quarterCircle':
      return (
        <div
          className="size-full"
          style={{ ...style, clipPath: 'circle(100% at 0 0)' }}
        />
      );
    case 'semicircle':
      return (
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full"
          style={style}
        />
      );
  }
}

function outerStyle(
  left: number,
  top: number,
  width: number,
  height: number,
  rotationDeg: number,
  entryOffset: EntryOffset | undefined,
): CSSProperties {
  const translate = entryOffset
    ? `translate(${entryOffset.dx}px, ${entryOffset.dy}px) `
    : '';
  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    transform: `${translate}rotate(${rotationDeg}deg)`,
  };
}

/**
 * L・S を描画する。位置・回転・入場の移動は外側要素 (ref 対象、揺れの
 * transform もここへ直接書き込まれる) に、質感の塗りは内側要素に持たせる
 * (design.md ShapeView 節)。
 */
function SolidShapeView({
  shape,
  entryOffset,
  elRef,
}: {
  shape: Extract<PlacedShape, { tier: 'L' | 'S' }>;
  entryOffset: EntryOffset | undefined;
  elRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={elRef}
      data-bg-shape=""
      data-bg-tier={shape.tier}
      data-shape-kind={shape.kind}
      style={outerStyle(
        shape.cx - shape.size / 2,
        shape.cy - shape.size / 2,
        shape.size,
        shape.size,
        shape.rot,
        entryOffset,
      )}
    >
      <ShapeFill kind={shape.kind} texture={shape.texture} />
    </div>
  );
}

/**
 * ∞ を描画する。外側要素 (1.74D × D、design.md「ShapeView / ShapeMotion」) は
 * 回転と揺れの transform だけを持ち、入場の移動は持たない。中の 2 つの輪
 * (直径 D・線幅 0.1D・中心間距離 0.74D) がそれぞれ独立した入場の起点と
 * 遅延を持つ (要件 6.3, 10.2)。輪は外側要素の局所座標に絶対配置されるため、
 * 外側要素の回転がそのまま両輪へ伝わる
 */
function InfShapeView({
  shape,
  ringEntryOffsets,
  elRef,
  ringRefs,
}: {
  shape: Extract<PlacedShape, { tier: 'Inf' }>;
  ringEntryOffsets: readonly [EntryOffset, EntryOffset] | undefined;
  elRef: (el: HTMLDivElement | null) => void;
  ringRefs: readonly [
    (el: HTMLDivElement | null) => void,
    (el: HTMLDivElement | null) => void,
  ];
}) {
  const D = shape.size;
  const width = 1.74 * D;
  const strokeWidth = D * 0.1;
  const ringLeft: readonly [number, number] = [0, 0.74 * D];

  return (
    <div
      ref={elRef}
      data-bg-shape=""
      data-bg-tier="Inf"
      style={outerStyle(
        shape.cx - width / 2,
        shape.cy - D / 2,
        width,
        D,
        shape.rot,
        undefined,
      )}
    >
      {([0, 1] as const).map((i) => {
        const offset = ringEntryOffsets?.[i];
        const translate = offset
          ? `translate(${offset.dx}px, ${offset.dy}px)`
          : undefined;
        return (
          <div
            key={i}
            ref={ringRefs[i]}
            data-bg-ring={i}
            className={`absolute rounded-full ${RING_BORDER_CLASS[shape.colors[i]]}`}
            style={{
              left: ringLeft[i],
              top: 0,
              width: D,
              height: D,
              borderStyle: 'solid',
              borderWidth: strokeWidth,
              transform: translate,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * 図形の入場 (初回だけ画面外寄りの起点から定位置へ寄せる) と、入場後のポインター・
 * スクロール入力によるばねの揺れを 1 つの `requestAnimationFrame` ループで駆動する。
 * DOM 要素へは ref 経由で直接 style を書き込み、揺れの毎フレーム更新で React の
 * 再描画を発生させない。∞ は外側要素 (揺れ・回転) と 2 つの輪 (入場) で
 * アニメーション対象が分かれるため、輪の ref・入場処理だけ分岐する
 */
function useShapeMotion(
  shapes: readonly PlacedShape[],
  entryOffsets: EntryOffset[],
  motionParams: ShapeMotionParams[],
  reduced: boolean,
) {
  const elsRef = useRef<(HTMLDivElement | null)[]>([]);
  const ringElsRef = useRef<((HTMLDivElement | null)[] | undefined)[]>([]);

  useEffect(() => {
    elsRef.current.length = shapes.length;
    ringElsRef.current.length = shapes.length;
    // モーション停止指定の間は入場もばねの揺れも行わない。図形は定位置のまま静止する
    if (reduced) return;

    const els = elsRef.current;
    // triggered: 入場アニメーションを開始済みか (1 図形につき 1 回のガード)。
    // ready: 入場アニメーションが終わり揺れの対象になったか
    const triggered = new Array<boolean>(shapes.length).fill(false);
    const ready = new Array<boolean>(shapes.length).fill(false);
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const startEntry = (index: number) => {
      const shape = shapes[index];
      const duration = entryDurationMs(shape.tier);
      const ringEls = ringElsRef.current[index];

      if (shape.tier === 'Inf' && ringEls) {
        const [r1, r2] = infRingEntryOffsets(index);
        const offsets = [r1, r2];
        for (let ri = 0; ri < 2; ri++) {
          const ringEl = ringEls[ri];
          if (!ringEl) continue;
          const offset = offsets[ri];
          const delay = offset.delayMs ? ` ${offset.delayMs}ms` : '';
          ringEl.style.transition = `transform ${duration}ms ${ENTRY_EASING}${delay}`;
          ringEl.style.transform = 'translate(0px, 0px)';
        }
        const maxDelay = Math.max(r1.delayMs, r2.delayMs);
        timeouts.push(
          setTimeout(() => {
            for (const ringEl of ringEls) {
              if (ringEl) ringEl.style.transition = '';
            }
            ready[index] = true;
          }, duration + maxDelay),
        );
        return;
      }

      const el = els[index];
      if (!el) return;
      const offset = entryOffsets[index];
      const delay = offset.delayMs ? ` ${offset.delayMs}ms` : '';
      el.style.transition = `transform ${duration}ms ${ENTRY_EASING}${delay}`;
      el.style.transform = `rotate(${shape.rot}deg)`;
      timeouts.push(
        setTimeout(() => {
          el.style.transition = '';
          ready[index] = true;
        }, duration + offset.delayMs),
      );
    };

    // 未対応環境 (旧ブラウザ・IntersectionObserver 非対応の jsdom 等) では入場の
    // 検知を諦め、揺れだけは動かせるよう定位置から即座に開始する
    const io =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target as HTMLDivElement;
                io?.unobserve(el);
                const index = els.indexOf(el);
                if (index === -1 || triggered[index]) continue;
                triggered[index] = true;
                startEntry(index);
              }
            },
            { threshold: INTERSECTION_THRESHOLD },
          );

    if (io) {
      for (const el of els) if (el) io.observe(el);
    } else {
      for (let i = 0; i < shapes.length; i++) {
        const el = els[i];
        if (!el) continue;
        el.style.transform = `rotate(${shapes[i].rot}deg)`;
        ready[i] = true;
      }
    }

    const springStates: SpringState[] = shapes.map(() => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    let pointer = { x: 0, y: 0 };
    let isTouch = false;
    let lastPointerMoveAt = 0;
    let lastScrollY = window.scrollY;
    let lastFrameAt: number | null = null;
    let rafId: number | null = null;

    const tick = (time: number) => {
      const dtMs = lastFrameAt === null ? 0 : clampFrameDt(time - lastFrameAt);
      lastFrameAt = time;
      const dt = dtMs / 1000;

      const pointerActive =
        !isTouch && Date.now() - lastPointerMoveAt < POINTER_ACTIVE_WINDOW_MS;
      const scrollY = window.scrollY;
      const scrollDelta = scrollY - lastScrollY;
      lastScrollY = scrollY;

      let anyUnsettled = false;
      // getBoundingClientRect (読み取り) と style.transform (書き込み) を図形ごとに
      // 交互に行うと強制同期レイアウトが起きるため、読み取り・計算を先に済ませ
      // 書き込みは後でまとめる 2 パスに分ける
      const nextTransforms: (string | null)[] = new Array(shapes.length).fill(
        null,
      );

      for (let i = 0; i < shapes.length; i++) {
        if (!ready[i]) continue;
        const el = els[i];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (isOffscreenVertically(rect.top, rect.bottom, window.innerHeight)) {
          continue;
        }

        const params = motionParams[i];
        const state = springStates[i];

        let ax = 0;
        let ay = 0;
        if (pointerActive) {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const repulsion = computeRepulsionAccel(
            { x: centerX, y: centerY },
            pointer,
            params.repulseRadius,
            REPULSE_MAX_ACCEL,
          );
          ax += repulsion.ax;
          ay += repulsion.ay;
        }
        if (scrollDelta !== 0) {
          state.vy += scrollVelocityImpulse(scrollDelta, params.scrollCoeff);
        }

        const stepped = stepSpring(
          state,
          { ax, ay },
          params.stiffness,
          params.damping,
          dt,
        );
        const clamped = clampDisplacement(
          stepped.x,
          stepped.y,
          params.displacementClamp,
        );
        state.x = clamped.x;
        state.y = clamped.y;
        state.vx = stepped.vx;
        state.vy = stepped.vy;

        if (isSettled(state)) {
          state.x = 0;
          state.y = 0;
          state.vx = 0;
          state.vy = 0;
        } else {
          anyUnsettled = true;
        }

        nextTransforms[i] =
          `translate(${state.x}px, ${state.y}px) rotate(${shapes[i].rot}deg)`;
      }

      for (let i = 0; i < shapes.length; i++) {
        const transform = nextTransforms[i];
        if (transform === null) continue;
        const el = els[i];
        if (el) el.style.transform = transform;
      }

      if (pointerActive || scrollDelta !== 0 || anyUnsettled) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
        lastFrameAt = null;
      }
    };

    const ensureLoopRunning = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      isTouch = event.pointerType === 'touch';
      if (isTouch) return; // タッチ端末では反発を行わない
      pointer = { x: event.clientX, y: event.clientY };
      lastPointerMoveAt = Date.now();
      ensureLoopRunning();
    };
    const onScroll = () => ensureLoopRunning();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io?.disconnect();
      for (const timeout of timeouts) clearTimeout(timeout);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [shapes, entryOffsets, motionParams, reduced]);

  const registerEl = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      elsRef.current[index] = el;
    },
    [],
  );
  const registerRingEl = useCallback(
    (index: number, ring: 0 | 1) => (el: HTMLDivElement | null) => {
      const slot = ringElsRef.current[index] ?? [null, null];
      slot[ring] = el;
      ringElsRef.current[index] = slot;
    },
    [],
  );

  return { registerEl, registerRingEl };
}

function ShapeList({
  shapes,
  sections,
  reduced,
}: {
  shapes: readonly PlacedShape[];
  sections: readonly SectionRect[];
  reduced: boolean;
}) {
  // shapes 自体が毎レンダー新しい配列だと参照の変化を検知する useShapeMotion の
  // effect が無駄に張り直され、入場のタイマーもやり直しになる。呼び出し元
  // (BackgroundShapes) の useMemo による安定化がそのままここまで効く
  const entryOffsets = useMemo(
    () => computeEntryOffsets(shapes, sections),
    [shapes, sections],
  );
  const motionParams = useMemo(
    () => shapes.map(deriveShapeMotionParams),
    [shapes],
  );
  const { registerEl, registerRingEl } = useShapeMotion(
    shapes,
    entryOffsets,
    motionParams,
    reduced,
  );

  return (
    <>
      {shapes.map((shape, index) =>
        shape.tier === 'Inf' ? (
          <InfShapeView
            key={index}
            shape={shape}
            ringEntryOffsets={reduced ? undefined : infRingEntryOffsets(index)}
            elRef={registerEl(index)}
            ringRefs={[registerRingEl(index, 0), registerRingEl(index, 1)]}
          />
        ) : (
          <SolidShapeView
            key={index}
            shape={shape}
            entryOffset={reduced ? undefined : entryOffsets[index]}
            elRef={registerEl(index)}
          />
        ),
      )}
    </>
  );
}

const ZERO_DEFICIT: Readonly<Record<Tier, number>> = { Inf: 0, L: 0, S: 0 };

interface MeasureState {
  // pathname と幅が同じ間は base (配置結果) を再利用する (要件 9.1, 9.3)
  key: { pathname: string; width: number };
  base: readonly PlacedShape[];
  visible: readonly PlacedShape[];
  sections: SectionRect[];
  deficit: Readonly<Record<Tier, number>>;
}

function currentInput(pathname: string): PlacementInput | null {
  const containerEl = document.getElementById(PAGE_CONTAINER_ID);
  if (!containerEl) return null;
  const platform: Platform =
    window.innerWidth >= LG_BREAKPOINT_PX ? 'pc' : 'sp';
  return { pathname, platform, ...collectObstacles(containerEl) };
}

/** 配置をやり直す (初回、または pathname・幅が変わったとき)。 */
function measureFull(pathname: string): MeasureState | null {
  const input = currentInput(pathname);
  const mainEl = document.getElementById(MAIN_CONTENT_ID);
  if (!input || !mainEl) return null;

  const { shapes, deficit } = placeBackgroundShapes(input);
  return {
    key: { pathname, width: input.width },
    base: shapes,
    visible: shapes,
    sections: collectSectionRects(mainEl),
    deficit,
  };
}

/**
 * 保持した配置 (base) はそのまま、最新の障害物に反する図形だけを間引く
 * (要件 9.1, 9.2)。∞ の下限個数・4 質感の網羅は問わないため deficit は
 * 更新しない (design.md reuse 節)。
 */
function refilter(prev: MeasureState, pathname: string): MeasureState | null {
  const input = currentInput(pathname);
  const mainEl = document.getElementById(MAIN_CONTENT_ID);
  if (!input || !mainEl) return null;

  const { visible } = filterForObstacles(prev.base, input);
  return {
    ...prev,
    visible,
    sections: collectSectionRects(mainEl),
  };
}

/** 開発ビルドでのみ、不足した階層を警告する (design.md Error Handling)。 */
function warnDeficit(deficit: Readonly<Record<Tier, number>>) {
  if (process.env.NODE_ENV === 'production') return;
  if (deficit.Inf === 0 && deficit.L === 0 && deficit.S === 0) return;
  console.warn(
    `[background-shapes] 図形の配置が目標数に届きませんでした (Inf不足=${deficit.Inf}, L不足=${deficit.L}, S不足=${deficit.S})`,
  );
}

/**
 * サイト共通の枠 (`(site)/layout.tsx`) の地に背景の図形装飾を描画する。
 * レイアウト計測が必要なためクライアントでのみ描画し、計測前 (サーバー描画・
 * hydration 直後) は何も描画しない。フォント読み込み完了 (`document.fonts.ready`)
 * を待ってから初回計測する (1.7 の書体切替で図形が動いて見えないようにするため)。
 * `document.fonts` が無い環境 (テストの jsdom) ではマイクロタスク 1 つ分だけ遅らせて
 * 計測する (同期実行すると、mount 直後・テストがスタブを整える前の DOM で計測してしまう)
 */
export function BackgroundShapes() {
  const pathname = usePathname();
  const { reduced } = useMotionPreference();
  const [state, setState] = useState<MeasureState | null>(null);
  // resize/ResizeObserver のコールバックは effect 実行時点の state を閉じ込めた
  // 古い closure から呼ばれうるため、常に最新の state を読めるよう ref も併せ持つ
  const stateRef = useRef<MeasureState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    const runFull = () => {
      if (cancelled) return;
      setState(measureFull(pathname));
    };

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(runFull);
    } else {
      queueMicrotask(runFull);
    }

    const onResize = () => {
      const width = window.innerWidth;
      const current = stateRef.current;
      // 幅が変わっていなければ計算し直さない (要件 9.3 の裏返し)。初回計測が
      // まだ済んでいない間は fonts.ready 待ちの runFull に任せる
      if (!current || current.key.width === width) return;
      setState(measureFull(pathname));
    };
    window.addEventListener('resize', onResize);

    // 検索・絞り込みによる一覧の件数変化など、幅を変えない DOM の高さ変化を拾う
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const current = stateRef.current;
        if (!current) return;
        setState(refilter(current, pathname));
      });
      observer.observe(document.body);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    if (state) warnDeficit(state.deficit);
  }, [state]);

  // state.visible は再計測・間引きのときだけ差し替わるが、reduced の切替など
  // state と無関係な再レンダーのたびにここで新しい配列を作ると、参照の変化を
  // 検知する useShapeMotion の effect が無駄に張り直される。state を基準に
  // useMemo で安定させる
  const shapes = useMemo(() => state?.visible ?? [], [state]);
  const sections = useMemo(() => state?.sections ?? [], [state]);
  const deficit = state?.deficit ?? ZERO_DEFICIT;

  if (!state) return null;

  return (
    <div
      aria-hidden="true"
      data-bg-shapes-body=""
      data-bg-deficit={`${deficit.Inf},${deficit.L},${deficit.S}`}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <ShapeList shapes={shapes} sections={sections} reduced={reduced} />
    </div>
  );
}
