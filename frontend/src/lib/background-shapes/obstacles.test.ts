import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectObstacles } from './obstacles';

function stubRect(
  el: Element,
  rect: { x: number; y: number; width: number; height: number },
) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON() {
      return this;
    },
  });
}

// obstacles.ts が固定のヘッダー高さ・page-container の構造を前提にするため、
// 実際のマークアップに近い最小限の骨格を組む
function buildPage(): { root: HTMLDivElement; main: HTMLElement } {
  const root = document.createElement('div');
  const header = document.createElement('header');
  const main = document.createElement('main');
  const footer = document.createElement('footer');
  root.append(header, main, footer);
  document.body.appendChild(root);
  stubRect(root, { x: 0, y: 0, width: 1024, height: 2000 });
  stubRect(header, { x: 0, y: 0, width: 1024, height: 80 });
  stubRect(footer, { x: 0, y: 1800, width: 1024, height: 200 });
  return { root, main };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('collectObstacles', () => {
  it('decorTop はヘッダー下端、decorBottom はフッター上端になる', () => {
    const { root } = buildPage();

    const { decorTop, decorBottom, height, width } = collectObstacles(root);

    expect(decorTop).toBe(80);
    expect(decorBottom).toBe(1800);
    expect(height).toBe(2000);
    expect(width).toBe(window.innerWidth);
  });

  it('[data-bg-hero] があれば decorTop をその下端にする', () => {
    const { root, main } = buildPage();
    const hero = document.createElement('section');
    hero.setAttribute('data-bg-hero', 'true');
    main.appendChild(hero);
    stubRect(hero, { x: 0, y: 80, width: 1024, height: 400 });

    const { decorTop } = collectObstacles(root);

    expect(decorTop).toBe(480);
  });

  it('[data-bg-bottom-nav] が可視なら decorBottom を「文書の高さ - タブナビの高さ」とフッター上端の小さい方にする', () => {
    // タブナビは position: fixed でビューポート下端に固定されるため、その
    // getBoundingClientRect().top は文書座標としては意味を持たない (スクロール量に
    // 依存して変わってしまう)。文書の高さからタブナビの高さを引いた値を使う
    const { root } = buildPage();
    const nav = document.createElement('nav');
    nav.setAttribute('data-bg-bottom-nav', 'true');
    root.appendChild(nav);
    // タブナビの getBoundingClientRect().top はビューポート内の位置 (スクロール0時点でも
    // 文書下端よりずっと小さい値になりうる) であり、文書座標の decorBottom には使わない
    stubRect(nav, { x: 0, y: 700, width: 1024, height: 64 });

    const { decorBottom } = collectObstacles(root);

    // buildPage(): 文書高さ 2000、フッター上端 1800。タブナビ由来の上限は 2000-64=1936 で
    // フッターの方が小さいため、フッターが decorBottom を決める
    expect(decorBottom).toBe(1800);
  });

  it('[data-bg-bottom-nav] のほうがフッター上端より制約が厳しいとき、decorBottom はタブナビ由来の値になる', () => {
    const { root } = buildPage();
    const footer = root.querySelector('footer')!;
    // フッターが文書のごく下端にしかない (footerTop が height に近い) 一方、
    // タブナビの高さがそれより大きい場合、タブナビ由来の上限が効く
    stubRect(footer, { x: 0, y: 1990, width: 1024, height: 10 });
    const nav = document.createElement('nav');
    nav.setAttribute('data-bg-bottom-nav', 'true');
    root.appendChild(nav);
    stubRect(nav, { x: 0, y: 700, width: 1024, height: 200 });

    const { decorBottom } = collectObstacles(root);

    // height(2000) - navHeight(200) = 1800 < footerTop(1990)
    expect(decorBottom).toBe(1800);
  });

  it('[data-bg-bottom-nav] が非表示 (display:none) なら decorBottom に影響しない', () => {
    const { root } = buildPage();
    const nav = document.createElement('nav');
    nav.setAttribute('data-bg-bottom-nav', 'true');
    nav.style.display = 'none';
    root.appendChild(nav);
    stubRect(nav, { x: 0, y: 1700, width: 1024, height: 64 });

    const { decorBottom } = collectObstacles(root);

    expect(decorBottom).toBe(1800);
  });
});
