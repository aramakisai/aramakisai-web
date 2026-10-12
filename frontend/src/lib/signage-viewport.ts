import { type RefObject, useEffect, useState } from 'react';
import type { SignageOrientation } from './signage';
import { CANVAS_SIZE } from './signage';

interface Size {
  readonly width: number;
  readonly height: number;
}

export interface CanvasFit {
  readonly scale: number;
  readonly left: number;
  readonly top: number;
}

/** 高さが幅を超えるときだけ縦型。正方形・測定不能(0)は横型 */
export function orientationOf(viewport: Size): SignageOrientation {
  return viewport.height > viewport.width ? 'portrait' : 'landscape';
}

/** min(幅比, 高さ比)で縮小し、余白を左右・上下に等分する */
export function fitCanvas(viewport: Size, canvas: Size): CanvasFit {
  const scale = Math.min(
    viewport.width / canvas.width,
    viewport.height / canvas.height,
  );
  return {
    scale,
    left: (viewport.width - canvas.width * scale) / 2,
    top: (viewport.height - canvas.height * scale) / 2,
  };
}

export interface CanvasLayout {
  readonly orientation: SignageOrientation;
  readonly fit: CanvasFit;
}

export function layoutFor(viewport: Size): CanvasLayout {
  const orientation = orientationOf(viewport);
  return { orientation, fit: fitCanvas(viewport, CANVAS_SIZE[orientation]) };
}

/**
 * 向きと倍率を、画面を覆う要素の実寸1か所から同時に決める。
 * メディアクエリ(向き)と window の resize(倍率)を別々に使うと、
 * 環境によって一方だけ更新されて向きと倍率が食い違い、キャンバスが切れる。
 * 測るまではnull(SSRとのhydration不一致を避ける)。
 */
export function useCanvasLayout(
  ref: RefObject<HTMLElement | null>,
): CanvasLayout | null {
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width <= 0 || height <= 0) return;
      setLayout(layoutFor({ width, height }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return layout;
}
