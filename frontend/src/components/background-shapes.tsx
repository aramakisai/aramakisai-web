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
import {
  extendBackgroundShapes,
  placeBackgroundShapes,
} from '@/lib/background-shapes/placement';
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

// 原画は箱の対角線を一辺とする正方形に敷いて回し、箱で切り抜く。どの角度でも箱の隅に原画の外が出ない。
// 背景の幅は回す前の箱の幅 × 2.5 (= 正方形の幅の 2.5/√2 倍)
const SQRT2 = 1.4143;

// geometry.ts の図形内外判定 (sampleShape) と同じ形を CSS で再現する。roundedSquare の角丸は
// geometry.ts の SDF (半径 s*0.18 の丸め箱) と border-radius が等価なので、
// 正方形の一辺に対する比率 (18%) をそのまま使える。quarterCircle は circle()
// の半径 100% が箱の対角線 (幅=高さの正方形では一辺と等しい) に正規化される
// CSS Shapes の仕様を使うと、半径 s・中心を左上角に置いた扇形に一致する。
// semicircle は円の下半分。inset の round に巨大な半径を渡す方式は半径の縮小規則
// (ブラウザ実装依存) に頼るため、circle と同じ rounded-full と inset の交差にする
const SHAPE_CLIP: Record<ShapeKind, { className: string; clipPath?: string }> =
  {
    circle: { className: 'rounded-full' },
    square: { className: '' },
    roundedSquare: { className: 'rounded-[18%]' },
    triangle: {
      className: '',
      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
    },
    quarterCircle: { className: '', clipPath: 'circle(100% at 0 0)' },
    semicircle: { className: 'rounded-full', clipPath: 'inset(50% 0 0 0)' },
  };

export function ShapeFill({
  kind,
  texture,
  pos,
  rot,
  opacity,
}: {
  kind: ShapeKind;
  texture: TextureId;
  pos: readonly [number, number];
  rot: number;
  opacity?: number;
}) {
  const { className, clipPath } = SHAPE_CLIP[kind];
  return (
    <div
      className={`relative size-full overflow-hidden ${className}`}
      style={{ clipPath, opacity }}
    >
      <div
        className="absolute top-1/2 left-1/2 aspect-square"
        style={{
          width: `${SQRT2 * 100}%`,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
          backgroundImage: `url(/images/textures/pamphlet/${texture}.webp)`,
          backgroundSize: `calc(250% / ${SQRT2}) auto`,
          backgroundPosition: `${pos[0]}% ${pos[1]}%`,
        }}
      />
    </div>
  );
}

function outerStyle(
  left: number,
  top: number,
  width: number,
  height: number,
  rotationDeg: number,
  hidden: boolean,
): CSSProperties {
  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    transform: `rotate(${rotationDeg}deg)`,
    visibility: hidden ? 'hidden' : 'visible',
  };
}

/**
 * L・S を描画する。位置・回転は外側要素 (ref 対象、揺れの transform もここへ
 * 直接書き込まれる) に、質感の塗りと入場の移動・不透明度は内側要素に持たせる。
 * 入場の起点は画面外になりうるため、交差判定は定位置に置いた外側要素で行う。
 */
function SolidShapeView({
  shape,
  pending,
  hidden,
  elRef,
}: {
  shape: Extract<PlacedShape, { tier: 'L' | 'S' }>;
  pending: boolean;
  hidden: boolean;
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
        hidden,
      )}
    >
      <ShapeFill
        opacity={pending ? 0 : undefined}
        kind={shape.kind}
        texture={shape.texture}
        pos={shape.texturePos}
        rot={shape.textureRot}
      />
    </div>
  );
}

/** ∞ の輪 1 つ (直径 D・線幅 0.1D)。2 つ目は 1 つ目から 0.74D 右に置く */
export function InfRing({
  index,
  diameter,
  color,
  elRef,
  opacity,
}: {
  index: 0 | 1;
  diameter: number;
  color: RingColor;
  elRef?: (el: HTMLDivElement | null) => void;
  opacity?: number;
}) {
  return (
    <div
      ref={elRef}
      data-bg-ring={index}
      className={`absolute rounded-full ${RING_BORDER_CLASS[color]}`}
      style={{
        left: index === 0 ? 0 : 0.74 * diameter,
        top: 0,
        width: diameter,
        height: diameter,
        borderStyle: 'solid',
        borderWidth: diameter * 0.1,
        opacity,
      }}
    />
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
  pending,
  hidden,
  elRef,
  ringRefs,
}: {
  shape: Extract<PlacedShape, { tier: 'Inf' }>;
  pending: boolean;
  hidden: boolean;
  elRef: (el: HTMLDivElement | null) => void;
  ringRefs: readonly [
    (el: HTMLDivElement | null) => void,
    (el: HTMLDivElement | null) => void,
  ];
}) {
  const D = shape.size;
  const width = 1.74 * D;

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
        hidden,
      )}
    >
      {([0, 1] as const).map((i) => (
        <InfRing
          key={i}
          index={i}
          diameter={D}
          color={shape.colors[i]}
          elRef={ringRefs[i]}
          opacity={pending ? 0 : undefined}
        />
      ))}
    </div>
  );
}

interface EntryRecord {
  anims: { anim: Animation; target: HTMLElement }[];
  remaining: number;
}

function cancelEntry(record: EntryRecord) {
  for (const { anim, target } of record.anims) {
    anim.cancel();
    target.style.opacity = '';
  }
}

/**
 * 図形の入場 (初回だけ画面外寄りの起点から定位置へ寄せつつ不透明度 0→1) と、入場後の
 * ポインター・スクロール入力によるばねの揺れを 1 つの `requestAnimationFrame` ループで
 * 駆動する。入場は Web Animations API で内側要素 (∞ は 2 つの輪) に掛け、停止・再実行・
 * 破棄の cancel で定位置・不透明度 1 に戻る (style への書き込みを残さない)。揺れは外側要素
 * へ ref 経由で直接 style を書き込み、毎フレームの更新で React の再描画を発生させない
 */
function useShapeMotion(
  shapes: readonly PlacedShape[],
  entryOffsets: EntryOffset[],
  motionParams: ShapeMotionParams[],
  reduced: boolean,
  entered: WeakSet<PlacedShape>,
) {
  const elsRef = useRef<(HTMLDivElement | null)[]>([]);
  const ringElsRef = useRef<((HTMLDivElement | null)[] | undefined)[]>([]);
  // 入場中の Animation と揺れのばね状態は図形をキーに effect の外で持つ。図形の追加で
  // effect が張り直されても、入場を打ち切らず揺れを 0 に戻さないため
  const runningRef = useRef(new Map<PlacedShape, EntryRecord>());
  const springsRef = useRef(new Map<PlacedShape, SpringState>());
  const settledRef = useRef(new WeakSet<PlacedShape>());

  useEffect(() => {
    const running = runningRef.current;
    return () => {
      for (const record of running.values()) cancelEntry(record);
      running.clear();
    };
  }, []);

  useEffect(() => {
    elsRef.current.length = shapes.length;
    ringElsRef.current.length = shapes.length;
    const running = runningRef.current;
    const springs = springsRef.current;
    const settled = settledRef.current;
    // モーション停止指定の間は入場もばねの揺れも行わない。図形は定位置のまま静止する
    if (reduced) {
      for (const record of running.values()) cancelEntry(record);
      running.clear();
      springs.clear();
      return;
    }

    const current = new Set(shapes);
    for (const [shape, record] of running) {
      if (!current.has(shape)) {
        cancelEntry(record);
        running.delete(shape);
      }
    }
    for (const shape of springs.keys()) {
      if (!current.has(shape)) springs.delete(shape);
    }

    const els = elsRef.current;
    // ready: 入場が済み揺れの対象になったか。入場済みの図形 (停止からの復帰・図形の追加で
    // この effect が張り直されたとき) は入場し直さず、そのまま揺れの対象にする
    const ready = shapes.map(
      (shape) => entered.has(shape) && !running.has(shape),
    );

    const entryTargets = (index: number): HTMLElement[] => {
      if (shapes[index].tier === 'Inf') {
        return (ringElsRef.current[index] ?? []).filter(
          (el): el is HTMLDivElement => el !== null,
        );
      }
      const inner = els[index]?.firstElementChild;
      return inner instanceof HTMLElement ? [inner] : [];
    };

    const startEntry = (index: number) => {
      const shape = shapes[index];
      entered.add(shape);
      const targets = entryTargets(index);
      const duration = entryDurationMs(shape.tier);
      const offsets =
        shape.tier === 'Inf'
          ? infRingEntryOffsets(index)
          : [entryOffsets[index]];
      if (targets.length === 0) {
        ready[index] = true;
        return;
      }
      const record: EntryRecord = { anims: [], remaining: targets.length };
      running.set(shape, record);
      const done = () => {
        if (--record.remaining > 0) return;
        running.delete(shape);
        settled.add(shape);
      };
      targets.forEach((target, i) => {
        const offset = offsets[i];
        if (typeof target.animate !== 'function') {
          target.style.opacity = '';
          done();
          return;
        }
        // 外側要素が回転しているため、L・S の移動は回転の逆変換で挟んでページ座標系の
        // 向きで動かす。∞ の輪は外側要素の局所 x 軸方向に動かす
        const at = (dx: number, dy: number) =>
          shape.tier === 'Inf'
            ? `translate(${dx}px, ${dy}px)`
            : `rotate(${-shape.rot}deg) translate(${dx}px, ${dy}px) rotate(${shape.rot}deg)`;
        const anim = target.animate(
          [
            { transform: at(offset.dx, offset.dy), opacity: 0 },
            { transform: at(0, 0), opacity: 1 },
          ],
          {
            duration,
            delay: offset.delayMs,
            easing: ENTRY_EASING,
            fill: 'both',
          },
        );
        record.anims.push({ anim, target });
        anim.onfinish = () => {
          target.style.opacity = '';
          anim.cancel();
          done();
        };
      });
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
                if (index === -1 || entered.has(shapes[index])) continue;
                startEntry(index);
              }
            },
            { threshold: INTERSECTION_THRESHOLD },
          );

    shapes.forEach((shape, i) => {
      if (ready[i] || entered.has(shape)) return;
      const el = els[i];
      if (!el) return;
      if (io) {
        io.observe(el);
      } else {
        entered.add(shape);
        for (const target of entryTargets(i)) target.style.opacity = '';
        ready[i] = true;
      }
    });

    const springStates: SpringState[] = shapes.map((shape) => {
      let state = springs.get(shape);
      if (!state) {
        state = { x: 0, y: 0, vx: 0, vy: 0 };
        springs.set(shape, state);
      }
      return state;
    });
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
        if (!ready[i] && !settled.has(shapes[i])) continue;
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
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [shapes, entryOffsets, motionParams, reduced, entered]);

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
  pathname,
  shapes,
  hidden,
  sections,
  reduced,
}: {
  pathname: string;
  shapes: readonly PlacedShape[];
  hidden: ReadonlySet<number>;
  sections: readonly SectionRect[];
  reduced: boolean;
}) {
  // shapes・sections 自体が毎レンダー新しい参照だと、それを検知する useShapeMotion の
  // effect が無駄に張り直され、入場アニメーションがやり直しになる (ちらつき)。
  // 呼び出し元 (BackgroundShapes) は同じ pathname・幅の間 base/sections の参照を
  // 変えないため、間引き (hidden の更新) だけでは effect は再発火しない
  const entryOffsets = useMemo(
    () => computeEntryOffsets(shapes, sections),
    [shapes, sections],
  );
  const motionParams = useMemo(
    () => shapes.map(deriveShapeMotionParams),
    [shapes],
  );
  // 入場済みの図形。停止→再生や図形の追加で effect が張り直されても入場し直さない。
  // 図形の配置し直しでは shape オブジェクトが作り直されるので自然にリセットされる
  const [entered] = useState(() => new WeakSet<PlacedShape>());
  const { registerEl, registerRingEl } = useShapeMotion(
    shapes,
    entryOffsets,
    motionParams,
    reduced,
    entered,
  );

  return (
    <>
      {shapes.map((shape, index) =>
        shape.tier === 'Inf' ? (
          <InfShapeView
            key={`${pathname}:${index}`}
            shape={shape}
            hidden={hidden.has(index)}
            pending={!reduced && !entered.has(shape)}
            elRef={registerEl(index)}
            ringRefs={[registerRingEl(index, 0), registerRingEl(index, 1)]}
          />
        ) : (
          <SolidShapeView
            key={`${pathname}:${index}`}
            shape={shape}
            hidden={hidden.has(index)}
            pending={!reduced && !entered.has(shape)}
            elRef={registerEl(index)}
          />
        ),
      )}
    </>
  );
}

const ZERO_DEFICIT: Readonly<Record<Tier, number>> = { Inf: 0, L: 0, S: 0 };
const EMPTY_HIDDEN: ReadonlySet<number> = new Set();

interface MeasureState {
  // pathname・幅・ヒーロー下端が同じ間は base (配置結果) の参照を作り直さない (要件 9.1, 9.3)。
  // 間引きは base を作り直さず hidden (base 内の非表示インデックス集合) だけで表す
  key: { pathname: string; width: number; decorTop: number };
  base: readonly PlacedShape[];
  hidden: ReadonlySet<number>;
  sections: SectionRect[];
  deficit: Readonly<Record<Tier, number>>;
  // 現在の配置が覆っている装飾範囲の下端。縮んだ後に再び伸びても覆い済みの範囲へは追加しない
  coveredBottom: number;
}

function currentInput(pathname: string): PlacementInput | null {
  const containerEl = document.getElementById(PAGE_CONTAINER_ID);
  if (!containerEl) return null;
  const platform: Platform =
    window.innerWidth >= LG_BREAKPOINT_PX ? 'pc' : 'sp';
  return { pathname, platform, ...collectObstacles(containerEl) };
}

/** 配置をやり直す (初回、または pathname・幅・ヒーロー下端が変わったとき)。 */
function measureFull(pathname: string): MeasureState | null {
  const input = currentInput(pathname);
  const mainEl = document.getElementById(MAIN_CONTENT_ID);
  if (!input || !mainEl) return null;

  const { shapes, deficit } = placeBackgroundShapes(input);
  return {
    key: { pathname, width: input.width, decorTop: input.decorTop },
    base: shapes,
    hidden: EMPTY_HIDDEN,
    sections: collectSectionRects(mainEl),
    deficit,
    coveredBottom: input.decorBottom,
  };
}

/** filterForObstacles が間引いた図形を、base に対するインデックス集合へ変換する。 */
function hiddenIndices(
  base: readonly PlacedShape[],
  input: PlacementInput,
): ReadonlySet<number> {
  const { dropped } = filterForObstacles(base, input);
  if (dropped.length === 0) return EMPTY_HIDDEN;
  // filterForObstacles は base の要素をそのまま (複製せず) 詰め直すだけなので、
  // 参照の一致で「どの要素が落ちたか」を判定できる
  const droppedSet = new Set(dropped);
  const hidden = new Set<number>();
  base.forEach((shape, i) => {
    if (droppedSet.has(shape)) hidden.add(i);
  });
  return hidden;
}

function sameHidden(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const i of a) if (!b.has(i)) return false;
  return true;
}

/**
 * 高さ変化への追従。base の既存の図形 (配置・DOM 要素とも) は動かさず、
 * - 最新の障害物と重なる図形だけを visibility:hidden にする (要件 9.1, 9.2)
 * - 装飾範囲が覆い済みの下端より下へ伸びていたら、伸びた範囲にだけ図形を追加する
 *
 * details-content の開閉アニメーションのように 1 回のトランジションで
 * ResizeObserver が何十回も発火する状況でも、追加が無い限り base の参照は変えない。
 * 追加で effect が張り直されても、入場済みの図形は入場し直さない。
 * 間引きでは ∞ の下限個数・4 質感の網羅は問わないため deficit は更新しない
 * (design.md reuse 節)。
 *
 * prev の pathname・幅が現在と違う間は、配置し直しの結果を古い配置で
 * 上書きしないよう何もしない。
 */
function refilter(prev: MeasureState, pathname: string): MeasureState | null {
  const input = currentInput(pathname);
  if (!input) return null;
  if (prev.key.pathname !== pathname || prev.key.width !== input.width) {
    return prev;
  }

  let base = prev.base;
  let sections = prev.sections;
  let coveredBottom = prev.coveredBottom;
  if (input.decorBottom > coveredBottom + 1) {
    const added = extendBackgroundShapes(input, base, coveredBottom);
    // 追加が無い間は覆い済みの下端を進めない。トランジション中の細かい伸びで
    // 範囲を使い切り、後で個数の目安に達したときに追加先が無くなるのを避ける
    if (added.length > 0) {
      base = [...base, ...added];
      coveredBottom = input.decorBottom;
      const mainEl = document.getElementById(MAIN_CONTENT_ID);
      if (mainEl) sections = collectSectionRects(mainEl);
    }
  }

  const hidden = hiddenIndices(base, input);
  if (base === prev.base && sameHidden(hidden, prev.hidden)) return prev;

  return { ...prev, base, sections, coveredBottom, hidden };
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
  const [measured, setState] = useState<MeasureState | null>(null);
  // 別ページの配置は fonts.ready を待つ間も描かない
  const state = measured?.key.pathname === pathname ? measured : null;
  // resize のコールバックは effect 実行時点の state を閉じ込めた古い closure から
  // 呼ばれうるため、幅の比較には常に最新の state を読めるよう ref も併せ持つ
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
      const current = stateRef.current;
      // 初回計測がまだ済んでいない間は fonts.ready 待ちの runFull に任せる。
      // 高さそのものは条件にしない (モバイルのアドレスバーの出入りで配置し直さないため)
      if (!current || current.key.pathname !== pathname) return;
      const input = currentInput(pathname);
      if (!input) return;
      if (
        current.key.width === input.width &&
        Math.abs(current.key.decorTop - input.decorTop) <= 0.5
      ) {
        return;
      }
      setState(measureFull(pathname));
    };
    window.addEventListener('resize', onResize);

    // 検索・絞り込みによる一覧の件数変化など、幅を変えない DOM の高さ変化を拾う
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        setState((prev) => (prev ? refilter(prev, pathname) : prev));
      });
      observer.observe(document.body);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [pathname]);

  // state.base/sections は同じ配置の間ずっと同じ参照 (refilter は追加が無ければ
  // hidden しか更新しない)。state 自体が refilter のたびに新しい object に
  // なっても、ここで読み出す base/sections の参照は変わらないので、それを
  // deps に持つ useShapeMotion の effect は張り直されない
  const shapes = useMemo(() => state?.base ?? [], [state]);
  const hidden = useMemo(() => state?.hidden ?? EMPTY_HIDDEN, [state]);
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
      <ShapeList
        pathname={pathname}
        shapes={shapes}
        hidden={hidden}
        sections={sections}
        reduced={reduced}
      />
    </div>
  );
}
