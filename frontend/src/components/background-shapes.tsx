'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  computeBackgroundShapePlacement,
  type PlacedShape,
  type Rect,
  type ShapeColorToken,
  type ShapeTexture,
} from '@/lib/background-shapes';
import {
  clampDisplacement,
  clampFrameDt,
  collectSectionRects,
  computeEntryOffsets,
  computeRepulsionAccel,
  deriveShapeMotionParams,
  isOffscreenVertically,
  isSettled,
  scrollVelocityImpulse,
  stepSpring,
  ENTRY_DURATION_MS,
  ENTRY_EASING,
  INTERSECTION_THRESHOLD,
  POINTER_ACTIVE_WINDOW_MS,
  REPULSE_MAX_ACCEL,
  type EntryOffset,
  type SectionRect,
  type ShapeMotionParams,
  type SpringState,
} from '@/lib/background-shapes-motion';
import { collectExcludeRects } from '@/lib/exclude-rects';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { HEADER_BG_SHAPES_SLOT_ID, MAIN_CONTENT_ID } from './header';

// (site)/layout.tsx の外側コンテナ (position: relative)。装飾レイヤーはこの内側に
// absolute inset-0 で敷くため、コンテナ自身の高さは装飾レイヤーを含まない
// (ヘッダー・BottomNavigation は fixed で本文の流れに参加しない)
export const PAGE_CONTAINER_ID = 'page-container';

// クラス名を動的な文字列結合 (`bg-${token}`) にすると Tailwind の静的解析が
// クラスを拾えず生成されない。トークンごとに完全なクラス名を列挙する
const BG_CLASS_BY_TOKEN: Record<ShapeColorToken, string> = {
  'bansai-ochre': 'bg-bansai-ochre',
  'bansai-olive': 'bg-bansai-olive',
  'bansai-sage': 'bg-bansai-sage',
  'bansai-salmon': 'bg-bansai-salmon',
  'bansai-rose': 'bg-bansai-rose',
  'bansai-wisteria': 'bg-bansai-wisteria',
  'bansai-aqua': 'bg-bansai-aqua',
};

const BORDER_CLASS_BY_TOKEN: Record<ShapeColorToken, string> = {
  'bansai-ochre': 'border-bansai-ochre',
  'bansai-olive': 'border-bansai-olive',
  'bansai-sage': 'border-bansai-sage',
  'bansai-salmon': 'border-bansai-salmon',
  'bansai-rose': 'border-bansai-rose',
  'bansai-wisteria': 'border-bansai-wisteria',
  'bansai-aqua': 'border-bansai-aqua',
};

// SVG の新規追加・ベクタ流用は行わず、質感は CSS のグラデーションのみで近似する
// (Figma 側は書き出し済みラスター画像による粒状ノイズ・網点を用いるが、
// 同じ画素を再現する資産をこのリポジトリには持ち込まない)
function textureStyle(texture: ShapeTexture): CSSProperties | undefined {
  switch (texture) {
    case 'none':
      return undefined;
    case 'halftone':
      return {
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.65) 30%, transparent 31%)',
        backgroundSize: '7px 7px',
      };
    case 'noise':
      return {
        backgroundImage:
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 45%), ' +
          'radial-gradient(circle at 70% 65%, rgba(0,0,0,0.2), transparent 50%), ' +
          'radial-gradient(circle at 55% 15%, rgba(255,255,255,0.25), transparent 40%)',
      };
    case 'cloud':
      return {
        backgroundImage:
          'radial-gradient(circle at 25% 20%, rgba(0,0,0,0.16), transparent 60%), ' +
          'radial-gradient(circle at 80% 85%, rgba(255,255,255,0.45), transparent 60%)',
      };
  }
}

function ShapeGlyph({ shape }: { shape: PlacedShape }) {
  const bgClass = BG_CLASS_BY_TOKEN[shape.color];
  const style = textureStyle(shape.texture);

  switch (shape.kind) {
    case 'circle':
      return (
        <div className={`size-full rounded-full ${bgClass}`} style={style} />
      );
    case 'square':
      return <div className={`size-full ${bgClass}`} style={style} />;
    case 'roundedSquare':
      return (
        <div className={`size-full rounded-[22%] ${bgClass}`} style={style} />
      );
    case 'triangle':
      // Figma (342:1928) の頂点は円に内接する正三角形 (M32 0 L59.7128 48 H4.28719)
      return (
        <div
          className={`size-full ${bgClass}`}
          style={{
            ...style,
            clipPath: 'polygon(50% 0%, 93.3% 75%, 6.7% 75%)',
          }}
        />
      );
    case 'quarterCircle':
      // Figma (342:1854) は箱中心 (32,32) を中心とする半径 32 の円の右下象限。
      // 象限の矩形クリップと、箱いっぱいの円 (rounded-full) の重なりで再現する
      return (
        <div
          className="size-full overflow-hidden"
          style={{ clipPath: 'inset(50% 0 0 50%)' }}
        >
          <div className={`size-full rounded-full ${bgClass}`} style={style} />
        </div>
      );
    case 'semicircle':
      // Figma (342:1780) は箱の下半分 (y=32〜64) を占め、平らな上辺が箱の中心を
      // 通る下向きのドーム
      return (
        <div
          className={`absolute inset-x-0 bottom-0 h-1/2 rounded-b-full ${bgClass}`}
          style={style}
        />
      );
    case 'ring': {
      // リングには質感を割り当てない (design.md #質感)。線幅 (ringStrokeWidth) は
      // 直径 (shape.size) の円の中心線上に描く前提の絶対値で、secondary (Figma
      // 342:2152) では自身の size に比例しない絶対値になるため、外径 = size + 線幅 の
      // ぶんだけ箱を膨らませる inset を px で直接計算する (%指定だと secondary で比率が崩れる)
      const strokeWidth = shape.ringStrokeWidth ?? shape.size * 0.16;
      return (
        <div
          className={`absolute rounded-full ${BORDER_CLASS_BY_TOKEN[shape.color]}`}
          style={{
            inset: -strokeWidth / 2,
            borderWidth: strokeWidth,
            opacity: shape.opacity ?? 1,
          }}
        />
      );
    }
  }
}

function shapeWrapperStyle(
  shape: PlacedShape,
  entryOffset: EntryOffset | undefined,
): CSSProperties {
  const translate = entryOffset
    ? `translate(${entryOffset.dx}px, ${entryOffset.dy}px) `
    : '';
  return {
    position: 'absolute',
    left: shape.x - shape.size / 2,
    top: shape.y - shape.size / 2,
    width: shape.size,
    height: shape.size,
    transform: `${translate}rotate(${shape.rotation}deg)`,
  };
}

/**
 * 図形の入場 (初回だけ画面外寄りの起点から定位置へ寄せる) と、入場後のポインター・
 * スクロール入力によるばねの揺れを 1 つの `requestAnimationFrame` ループで駆動する
 * (design.md「動き」、要件 23.15〜23.25)。DOM 要素へは ref 経由で直接 style を
 * 書き込み、揺れの毎フレーム更新で React の再描画を発生させない
 */
function useShapeMotion(
  shapes: PlacedShape[],
  entryOffsets: EntryOffset[],
  motionParams: ShapeMotionParams[],
  reduced: boolean,
) {
  const elsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    elsRef.current.length = shapes.length;
    // 21.4/23.26: 停止指定の間は入場もばねの揺れも行わない。図形は定位置のまま静止する
    if (reduced) return;

    const els = elsRef.current;
    // triggered: 入場アニメーションを開始済みか (要件 23.16「1 図形につき 1 回」の
    // ガード)。ready: 入場アニメーションが終わり揺れの対象になったか
    const triggered = new Array<boolean>(shapes.length).fill(false);
    const ready = new Array<boolean>(shapes.length).fill(false);
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // 未対応環境 (旧ブラウザ・IntersectionObserver 非対応の jsdom 等) では入場の
    // 検知を諦め、揺れだけは動かせるよう定位置から即座に開始する
    // (measure() の ResizeObserver と同じ feature-detection の方針)
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
                // unobserve 後も届きうる遅延コールバックに備え、要件 23.16 の
                // 「1 図形につき 1 回」を triggered フラグでも保証する
                if (index === -1 || triggered[index]) continue;
                triggered[index] = true;

                const offset = entryOffsets[index];
                const delay = offset.delayMs ? ` ${offset.delayMs}ms` : '';
                el.style.transition = `transform ${ENTRY_DURATION_MS}ms ${ENTRY_EASING}${delay}`;
                el.style.transform = `rotate(${shapes[index].rotation}deg)`;

                timeouts.push(
                  setTimeout(() => {
                    el.style.transition = '';
                    ready[index] = true;
                  }, ENTRY_DURATION_MS + offset.delayMs),
                );
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
        el.style.transform = `rotate(${shapes[i].rotation}deg)`;
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
      // 交互に行うと、書き込みが直前のレイアウトキャッシュを破棄し次の図形の
      // 読み取りで強制同期レイアウトが起きる (layout thrashing)。ページ高
      // 5000px 程度で図形が 40 個を超える見積もり (design.md) のもとスクロール中に
      // 毎フレーム発生するため、全図形の読み取り・計算を先に済ませ書き込みは
      // 後でまとめる 2 パスに分ける
      const nextTransforms: (string | null)[] = new Array(shapes.length).fill(
        null,
      );

      for (let i = 0; i < shapes.length; i++) {
        if (!ready[i]) continue;
        const el = els[i];
        if (!el) continue;

        // 23.25: 画面外の図形は計算を省く
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
          `translate(${state.x}px, ${state.y}px) rotate(${shapes[i].rotation}deg)`;
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
      if (isTouch) return; // 23.22: タッチ端末では反発を行わない
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

  return useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      elsRef.current[index] = el;
    },
    [],
  );
}

function ShapeList({
  shapes,
  entryOffsets,
  reduced,
}: {
  shapes: PlacedShape[];
  entryOffsets: EntryOffset[];
  reduced: boolean;
}) {
  // shapes 自体が毎レンダー新しい配列だと (呼び出し元で未メモ化のとき) ここも
  // 毎回作り直され、useShapeMotion の effect が無駄に張り直される。shapes の
  // 参照を基準にメモ化し、呼び出し元の安定化 (BackgroundShapes 側の useMemo) が
  // そのままここまで効くようにする
  const motionParams = useMemo(
    () => shapes.map(deriveShapeMotionParams),
    [shapes],
  );
  const registerEl = useShapeMotion(
    shapes,
    entryOffsets,
    motionParams,
    reduced,
  );

  return (
    <>
      {shapes.map((shape, index) => (
        <div
          key={index}
          ref={registerEl(index)}
          data-bg-shape=""
          data-shape-kind={shape.kind}
          style={shapeWrapperStyle(
            shape,
            reduced ? undefined : entryOffsets[index],
          )}
        >
          <ShapeGlyph shape={shape} />
        </div>
      ))}
    </>
  );
}

/**
 * ページのパスを種とした配置のうち、ヘッダーの高さ範囲に入る図形をヘッダー側、
 * それ以外を本文側に振り分ける (design.md 「配置先」)。ヘッダーは fixed 表示のため
 * 本文と別レイヤーで固定描画する必要がある
 */
export function splitShapesByHeaderHeight(
  shapes: readonly PlacedShape[],
  headerHeight: number,
): { headerShapes: PlacedShape[]; bodyShapes: PlacedShape[] } {
  const headerShapes: PlacedShape[] = [];
  const bodyShapes: PlacedShape[] = [];
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const next = shapes[i + 1];
    // リングの組 (primary→secondary の順で連続して現れる) は primary の y で一括して
    // 振り分ける。secondary 単独の y で判定すると、重なった二重の輪がヘッダーの
    // slot と本文レイヤーに分断されうる (ヘッダー slot は overflow-hidden)
    if (
      shape.kind === 'ring' &&
      shape.ringVariant === 'primary' &&
      next?.kind === 'ring' &&
      next.ringVariant === 'secondary'
    ) {
      const bucket = shape.y < headerHeight ? headerShapes : bodyShapes;
      bucket.push(shape, next);
      i++;
      continue;
    }
    (shape.y < headerHeight ? headerShapes : bodyShapes).push(shape);
  }
  return { headerShapes, bodyShapes };
}

function measure(pathname: string): {
  shapes: PlacedShape[];
  headerHeight: number;
  pageHeight: number;
  sections: SectionRect[];
} | null {
  const headerEl = document.querySelector('header');
  const mainEl = document.getElementById(MAIN_CONTENT_ID);
  const containerEl = document.getElementById(PAGE_CONTAINER_ID);
  if (!headerEl || !mainEl || !containerEl) return null;

  const headerHeight = headerEl.getBoundingClientRect().height;
  // 装飾レイヤー自身は absolute で外側コンテナの流れに参加しないため、
  // ここでコンテナの高さを測ってもレイヤーの前回の高さは混ざらない
  // (document.documentElement.scrollHeight だとレイヤーが縮んだ後の再計測でも
  // 過去の高さが残り続け、ページが縮んでも装飾レイヤーだけ縮まなくなる)
  const pageHeight = containerEl.getBoundingClientRect().height;
  const viewportWidth = window.innerWidth;

  // ヘッダーは fixed でビューポート先頭に固定されるため座標系の原点をそのまま使い、
  // 本文・フッターは document 座標へ揃えるため scrollY を加える (exclude-rects.ts 参照)
  const excludeRects: Rect[] = [
    ...collectExcludeRects(headerEl),
    ...collectExcludeRects(mainEl, { includeScrollOffset: true }),
  ];

  const footerEl = document.querySelector('footer');
  if (footerEl) {
    const footerRect = footerEl.getBoundingClientRect();
    if (footerRect.width > 0 && footerRect.height > 0) {
      excludeRects.push({
        x: footerRect.x,
        y: footerRect.y + window.scrollY,
        width: footerRect.width,
        height: footerRect.height,
      });
    }
  }

  const shapes = computeBackgroundShapePlacement({
    pathname,
    pageHeight,
    viewportWidth,
    excludeRects,
  });

  // 入場 (要件 23.15) の起点方向を決めるための「属するセクションの中心」。
  // main 直下のセクション要素の矩形も本文と同じくドキュメント座標へ揃える
  const sections = collectSectionRects(mainEl);

  return { shapes, headerHeight, pageHeight, sections };
}

/**
 * サイト共通の枠 (`(site)/layout.tsx`) の地に背景の図形装飾を描画する。
 * レイアウト計測が必要なためクライアントでのみ描画し、計測前 (サーバー描画・
 * hydration 直後) は何も描画しない (要件 23.13)
 */
export function BackgroundShapes() {
  const pathname = usePathname();
  const { reduced } = useMotionPreference();
  const [state, setState] = useState<{
    shapes: PlacedShape[];
    headerHeight: number;
    pageHeight: number;
    sections: SectionRect[];
  } | null>(null);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlotEl(document.getElementById(HEADER_BG_SHAPES_SLOT_ID));

    const recompute = () => setState(measure(pathname));
    recompute();

    window.addEventListener('resize', recompute);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(recompute);
      observer.observe(document.body);
    }
    return () => {
      window.removeEventListener('resize', recompute);
      observer?.disconnect();
    };
  }, [pathname]);

  // state.shapes は再計測 (measure) のときだけ差し替わるが、reduced の切替など
  // state と無関係な再レンダーのたびにここで新しい配列を作ると、参照の変化を
  // 検知する useShapeMotion の effect が無駄に張り直され、入場の 1 秒タイマーも
  // やり直しになる。state.shapes を基準に useMemo で安定させる
  const shapes = state?.shapes;
  const headerHeight = state?.headerHeight;
  const sections = state?.sections;

  const { headerShapes, bodyShapes } = useMemo(() => {
    if (!shapes || headerHeight === undefined) {
      return {
        headerShapes: [] as PlacedShape[],
        bodyShapes: [] as PlacedShape[],
      };
    }
    return splitShapesByHeaderHeight(shapes, headerHeight);
  }, [shapes, headerHeight]);

  const headerEntryOffsets = useMemo(
    () => computeEntryOffsets(headerShapes, sections ?? []),
    [headerShapes, sections],
  );
  const bodyEntryOffsets = useMemo(
    () => computeEntryOffsets(bodyShapes, sections ?? []),
    [bodyShapes, sections],
  );

  if (!state) return null;

  return (
    <>
      {slotEl &&
        createPortal(
          <ShapeList
            shapes={headerShapes}
            entryOffsets={headerEntryOffsets}
            reduced={reduced}
          />,
          slotEl,
        )}
      <div
        aria-hidden="true"
        data-bg-shapes-body=""
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <ShapeList
          shapes={bodyShapes}
          entryOffsets={bodyEntryOffsets}
          reduced={reduced}
        />
      </div>
    </>
  );
}
