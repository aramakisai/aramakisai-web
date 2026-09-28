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
  it('文字色の輝度が 0.5 未満の直下テキストを text に分類する', () => {
    const { root, main } = buildPage();
    const p = document.createElement('p');
    p.textContent = '本文';
    p.style.color = 'rgb(20, 20, 20)';
    main.appendChild(p);
    stubRect(p, { x: 10, y: 20, width: 100, height: 24 });

    const { text } = collectObstacles(root);

    expect(text).toContainEqual({ x: 10, y: 20, w: 100, h: 24 });
  });

  it('地を持たない a (文字リンク) を noOverlap に分類する', () => {
    const { root, main } = buildPage();
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'リンク';
    main.appendChild(a);
    stubRect(a, { x: 10, y: 20, width: 80, height: 24 });

    const { noOverlap, opaque } = collectObstacles(root);

    expect(noOverlap).toContainEqual({ x: 10, y: 20, w: 80, h: 24 });
    expect(opaque).toHaveLength(0);
  });

  it('地を持たないブロックリンク (行全体を包む a) は要素全体ではなく中の文字・アイコンのグリフ範囲だけを noOverlap にする', () => {
    const { root, main } = buildPage();
    const a = document.createElement('a');
    a.href = '#';
    const title = document.createElement('h3');
    title.textContent = 'お知らせタイトル';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-sharp';
    icon.textContent = 'chevron_right';
    a.append(title, icon);
    main.appendChild(a);
    // 行全体を包むブロックリンクなので要素自体の矩形は本文列の幅いっぱいになる
    stubRect(a, { x: 0, y: 100, width: 1024, height: 80 });
    stubRect(title, { x: 16, y: 120, width: 300, height: 24 });
    stubRect(icon, { x: 980, y: 128, width: 24, height: 24 });

    const { noOverlap, opaque } = collectObstacles(root);

    expect(noOverlap).toContainEqual({ x: 16, y: 120, w: 300, h: 24 });
    expect(noOverlap).toContainEqual({ x: 980, y: 128, w: 24, h: 24 });
    expect(noOverlap).not.toContainEqual({ x: 0, y: 100, w: 1024, h: 80 });
    expect(opaque).toHaveLength(0);
  });

  it('地を持たないブロックリンクの中の img は opaque として別に集め、noOverlap には含めない', () => {
    const { root, main } = buildPage();
    const a = document.createElement('a');
    a.href = '#';
    const thumb = document.createElement('img');
    const title = document.createElement('h3');
    title.textContent = 'お知らせタイトル';
    a.append(thumb, title);
    main.appendChild(a);
    stubRect(a, { x: 0, y: 100, width: 1024, height: 80 });
    stubRect(thumb, { x: 0, y: 100, width: 80, height: 80 });
    stubRect(title, { x: 96, y: 120, width: 300, height: 24 });

    const { noOverlap, opaque } = collectObstacles(root);

    expect(opaque).toContainEqual({ x: 0, y: 100, w: 80, h: 80 });
    expect(noOverlap).toContainEqual({ x: 96, y: 120, w: 300, h: 24 });
    expect(noOverlap).not.toContainEqual({ x: 0, y: 100, w: 80, h: 80 });
    expect(noOverlap).not.toContainEqual({ x: 0, y: 100, w: 1024, h: 80 });
  });

  it('地を持つ a を opaque に分類する', () => {
    const { root, main } = buildPage();
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'ボタン';
    a.style.backgroundColor = 'rgb(200, 100, 50)';
    main.appendChild(a);
    stubRect(a, { x: 10, y: 20, width: 120, height: 40 });

    const { opaque, noOverlap } = collectObstacles(root);

    expect(opaque).toContainEqual({ x: 10, y: 20, w: 120, h: 40 });
    expect(noOverlap).toHaveLength(0);
  });

  it('文字色の輝度が 0.85 超の白文字を noOverlap に分類する', () => {
    const { root, main } = buildPage();
    const p = document.createElement('p');
    p.textContent = '白文字';
    p.style.color = 'rgb(250, 250, 250)';
    main.appendChild(p);
    stubRect(p, { x: 10, y: 20, width: 100, height: 24 });

    const { noOverlap, text } = collectObstacles(root);

    expect(noOverlap).toContainEqual({ x: 10, y: 20, w: 100, h: 24 });
    expect(text).toHaveLength(0);
  });

  it('[data-bg-opaque] の面を opaque に分類し、内側の文字は個別に集めない', () => {
    const { root, main } = buildPage();
    const card = document.createElement('div');
    card.setAttribute('data-bg-opaque', 'true');
    const title = document.createElement('h3');
    title.textContent = 'カード見出し';
    title.style.color = 'rgb(10, 10, 10)';
    card.appendChild(title);
    main.appendChild(card);
    stubRect(card, { x: 0, y: 100, width: 300, height: 200 });
    stubRect(title, { x: 10, y: 110, width: 200, height: 24 });

    const { opaque, text } = collectObstacles(root);

    expect(opaque).toContainEqual({ x: 0, y: 100, w: 300, h: 200 });
    expect(text).toHaveLength(0);
  });

  it('img 要素を opaque に分類する', () => {
    const { root, main } = buildPage();
    const img = document.createElement('img');
    main.appendChild(img);
    stubRect(img, { x: 0, y: 100, width: 300, height: 200 });

    const { opaque } = collectObstacles(root);

    expect(opaque).toContainEqual({ x: 0, y: 100, w: 300, h: 200 });
  });

  it('幅または高さが 2px 以下の罫線は無視する', () => {
    const { root, main } = buildPage();
    const hr = document.createElement('div');
    hr.setAttribute('data-bg-opaque', 'true');
    main.appendChild(hr);
    stubRect(hr, { x: 0, y: 100, width: 1024, height: 1 });

    const { opaque } = collectObstacles(root);

    expect(opaque).toHaveLength(0);
  });

  it('aria-hidden の部分木は丸ごと無視する', () => {
    const { root, main } = buildPage();
    const hidden = document.createElement('div');
    hidden.setAttribute('aria-hidden', 'true');
    const p = document.createElement('p');
    p.textContent = '隠れた本文';
    p.style.color = 'rgb(0, 0, 0)';
    hidden.appendChild(p);
    main.appendChild(hidden);
    stubRect(hidden, { x: 0, y: 0, width: 400, height: 800 });
    stubRect(p, { x: 10, y: 10, width: 100, height: 20 });

    const { text } = collectObstacles(root);

    expect(text).toHaveLength(0);
  });

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
