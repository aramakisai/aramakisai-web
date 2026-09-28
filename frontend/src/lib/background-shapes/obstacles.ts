import type { PlacementInput, Rect } from './types';

// 幅または高さがこれ以下の矩形は罫線とみなし、障害物として扱わない
const HAIRLINE_MAX = 2;

interface Buckets {
  text: Rect[];
  noOverlap: Rect[];
  opaque: Rect[];
}

function isSkipped(el: Element): boolean {
  return el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert');
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

function hasOwnText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent ?? '').trim().length > 0
    ) {
      return true;
    }
  }
  return false;
}

// design.md の輝度式 (0.2126R + 0.7152G + 0.0722B、ガンマ補正なし)。
// WCAG の相対輝度とは異なる単純な加重和を Figma 版の抽出ツールに合わせて使う
function luminanceOf(color: string): number | null {
  const m = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hasBackground(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const m = style.backgroundColor.match(
    /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,\s]+([\d.]+))?\s*\)/,
  );
  if (!m) return false;
  const alpha = m[1] === undefined ? 1 : Number(m[1]);
  return alpha > 0;
}

function glyphRects(el: Element): DOMRect[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  return Array.from(range.getClientRects());
}

function toRect(domRect: DOMRect, scrollY: number): Rect {
  return { x: domRect.x, y: domRect.y + scrollY, w: domRect.width, h: domRect.height };
}

function isHairline(domRect: DOMRect): boolean {
  return domRect.width <= HAIRLINE_MAX || domRect.height <= HAIRLINE_MAX;
}

/**
 * main 配下を歩き、黒文字・重ねない要素・不透明な面の 3 分類へ振り分ける
 * (design.md 「obstacles」)。不透明な面・ロゴ・操作要素は自身の矩形だけを
 * 採り、内側へは潜らない。opaque な面の裏に L がまわり込むことを許すため
 * (要件 7.6)、面の中の文字を個別に障害物として扱う必要が無い
 */
function collect(root: Element, scrollY: number): Buckets {
  const text: Rect[] = [];
  const noOverlap: Rect[] = [];
  const opaque: Rect[] = [];

  const push = (bucket: Rect[], domRect: DOMRect) => {
    if (domRect.width <= 0 || domRect.height <= 0) return;
    if (isHairline(domRect)) return;
    bucket.push(toRect(domRect, scrollY));
  };
  const pushAll = (bucket: Rect[], rects: DOMRect[]) => {
    for (const r of rects) push(bucket, r);
  };

  const walk = (el: Element) => {
    if (isSkipped(el) || !isVisible(el)) return;

    if (el.hasAttribute('data-bg-logo')) {
      push(noOverlap, el.getBoundingClientRect());
      return;
    }
    if (el.matches('[data-bg-opaque], img, input, textarea, select')) {
      push(opaque, el.getBoundingClientRect());
      return;
    }
    if (el.matches('a, button')) {
      push(hasBackground(el) ? opaque : noOverlap, el.getBoundingClientRect());
      return;
    }

    if (hasOwnText(el)) {
      const luminance = luminanceOf(window.getComputedStyle(el).color);
      if (luminance !== null) {
        if (luminance < 0.5) pushAll(text, glyphRects(el));
        else if (luminance > 0.85) pushAll(noOverlap, glyphRects(el));
      }
    }

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
  return { text, noOverlap, opaque };
}

/**
 * root (`#page-container` 相当) から、pathname・platform を除く配置の入力一式を
 * DOM 計測で求める (design.md 「obstacles」)。文字・操作要素・不透明な面の分類は
 * `<main>` の中だけを対象にする。ヘッダー・フッター・下部タブナビの中身は
 * decorTop/decorBottom の外なので個別に分類する必要が無い
 */
export function collectObstacles(
  root: HTMLElement,
): Omit<PlacementInput, 'pathname' | 'platform'> {
  const scrollY = window.scrollY;
  const width = window.innerWidth;
  const height = root.getBoundingClientRect().height;

  const headerEl = root.querySelector('header');
  const heroEl = root.querySelector('[data-bg-hero]');
  const footerEl = root.querySelector('footer');
  const bottomNavEl = root.querySelector('[data-bg-bottom-nav]');

  // ヘッダーは position: fixed でビューポート先頭に固定されており、その座標が
  // 図形配置と同じ「ページ座標」の原点と一致するため scrollY を加えない
  // (exclude-rects.ts と同じ前提)。hero は通常の文書内要素なので加える
  const headerBottom = headerEl?.getBoundingClientRect().bottom ?? 0;
  const decorTop = heroEl
    ? heroEl.getBoundingClientRect().bottom + scrollY
    : headerBottom;

  const footerTop = footerEl
    ? footerEl.getBoundingClientRect().top + scrollY
    : height;
  const bottomNavTop =
    bottomNavEl && isVisible(bottomNavEl)
      ? bottomNavEl.getBoundingClientRect().top + scrollY
      : Infinity;
  const decorBottom = Math.min(footerTop, bottomNavTop);

  const mainEl = root.querySelector('main') ?? root;
  const { text, noOverlap, opaque } = collect(mainEl, scrollY);

  return { width, height, decorTop, decorBottom, text, noOverlap, opaque };
}
