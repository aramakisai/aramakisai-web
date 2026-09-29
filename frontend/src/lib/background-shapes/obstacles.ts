import type { PlacementInput } from './types';

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * root (`#page-container` 相当) から、pathname・platform を除く配置の入力一式を
 * DOM 計測で求める (design.md 「obstacles」)。
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

  return { width, height, decorTop, decorBottom };
}
