import type { PlacementInput, Rect } from './types';

// 幅または高さがこれ以下の矩形は罫線とみなし、障害物として扱わない
const HAIRLINE_MAX = 2;

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

function hasBackground(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const m = style.backgroundColor.match(
    /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,\s]+([\d.]+))?\s*\)/,
  );
  if (!m) return false;
  const alpha = m[1] === undefined ? 1 : Number(m[1]);
  return alpha > 0;
}

function toRect(domRect: DOMRect, scrollY: number): Rect {
  return {
    x: domRect.x,
    y: domRect.y + scrollY,
    w: domRect.width,
    h: domRect.height,
  };
}

function isHairline(domRect: DOMRect): boolean {
  return domRect.width <= HAIRLINE_MAX || domRect.height <= HAIRLINE_MAX;
}

/**
 * main 配下を歩き、不透明な面だけを集める (design.md「obstacles」)。自身が
 * 不透明な面に一致した要素は矩形だけを採り内側へは潜らない。opaque な面の裏に
 * L がまわり込むことを許すため (要件 7.6)、面の中の子孫を個別に扱う必要が無い。
 * 地を持たない a/button はここでは何も採らず子を辿るだけなので、中の img 等の
 * opaque な子孫はそのまま拾える
 */
function collectOpaque(root: Element, scrollY: number): Rect[] {
  const opaque: Rect[] = [];

  const push = (domRect: DOMRect) => {
    if (domRect.width <= 0 || domRect.height <= 0) return;
    if (isHairline(domRect)) return;
    opaque.push(toRect(domRect, scrollY));
  };

  const walk = (el: Element) => {
    if (isSkipped(el) || !isVisible(el)) return;

    if (el.matches('[data-bg-opaque], img, input, textarea, select')) {
      push(el.getBoundingClientRect());
      return;
    }
    if (el.matches('a, button') && hasBackground(el)) {
      push(el.getBoundingClientRect());
      return;
    }

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
  return opaque;
}

/**
 * root (`#page-container` 相当) から、pathname・platform を除く配置の入力一式を
 * DOM 計測で求める (design.md 「obstacles」)。不透明な面の収集は `<main>` の
 * 中だけを対象にする。ヘッダー・フッター・下部タブナビの中身は decorTop/decorBottom
 * の外なので個別に分類する必要が無い
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
  // 下部タブナビは position: fixed でビューポート下端に固定されており、
  // getBoundingClientRect().top はスクロール量に応じて変わるだけで文書座標としての
  // 意味を持たない (そのまま + scrollY すると初回計測時のスクロール位置で装飾範囲が
  // 決まってしまい、最初の 1 画面だけに縮む)。文書の高さからタブナビ自身の高さを
  // 引いた値 (タブナビが文書の一番下に常駐しているとみなした場合の上端) を使う
  const bottomNavBottom =
    bottomNavEl && isVisible(bottomNavEl)
      ? height - bottomNavEl.getBoundingClientRect().height
      : Infinity;
  const decorBottom = Math.min(footerTop, bottomNavBottom);

  const mainEl = root.querySelector('main') ?? root;
  const opaque = collectOpaque(mainEl, scrollY);

  return { width, height, decorTop, decorBottom, opaque };
}
