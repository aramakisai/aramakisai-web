'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  computeBackgroundShapePlacement,
  type PlacedShape,
  type Rect,
  type ShapeColorToken,
  type ShapeTexture,
} from '@/lib/background-shapes';
import { collectExcludeRects } from '@/lib/exclude-rects';
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

function shapeWrapperStyle(shape: PlacedShape): CSSProperties {
  return {
    position: 'absolute',
    left: shape.x - shape.size / 2,
    top: shape.y - shape.size / 2,
    width: shape.size,
    height: shape.size,
    transform: `rotate(${shape.rotation}deg)`,
  };
}

function ShapeList({ shapes }: { shapes: PlacedShape[] }) {
  return (
    <>
      {shapes.map((shape, index) => (
        <div
          key={index}
          data-bg-shape=""
          data-shape-kind={shape.kind}
          style={shapeWrapperStyle(shape)}
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

  return { shapes, headerHeight, pageHeight };
}

/**
 * サイト共通の枠 (`(site)/layout.tsx`) の地に背景の図形装飾を描画する。
 * レイアウト計測が必要なためクライアントでのみ描画し、計測前 (サーバー描画・
 * hydration 直後) は何も描画しない (要件 23.13)
 */
export function BackgroundShapes() {
  const pathname = usePathname();
  const [state, setState] = useState<{
    shapes: PlacedShape[];
    headerHeight: number;
    pageHeight: number;
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

  if (!state) return null;

  const { headerShapes, bodyShapes } = splitShapesByHeaderHeight(
    state.shapes,
    state.headerHeight,
  );

  return (
    <>
      {slotEl && createPortal(<ShapeList shapes={headerShapes} />, slotEl)}
      <div
        aria-hidden="true"
        data-bg-shapes-body=""
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <ShapeList shapes={bodyShapes} />
      </div>
    </>
  );
}
