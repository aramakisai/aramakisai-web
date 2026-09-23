import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectExcludeRects } from './exclude-rects';

// jsdom は実レイアウトを持たないため getBoundingClientRect は既定で全て 0 を返す。
// 各要素へ個別にスタブして「どの要素が拾われるか」だけを検証する
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

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('collectExcludeRects', () => {
  it('直接テキストを持つ葉要素を除外対象として拾う', () => {
    const root = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '本文';
    root.appendChild(p);
    document.body.appendChild(root);
    stubRect(p, { x: 10, y: 20, width: 100, height: 24 });

    const rects = collectExcludeRects(root);

    expect(rects).toContainEqual({ x: 10, y: 20, width: 100, height: 24 });
  });

  it('子要素だけを持ちテキストを持たないラッパー要素は含めない', () => {
    const root = document.createElement('div');
    const wrapper = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = 'テキスト';
    wrapper.appendChild(p);
    root.appendChild(wrapper);
    document.body.appendChild(root);
    stubRect(wrapper, { x: 0, y: 0, width: 200, height: 200 });
    stubRect(p, { x: 5, y: 5, width: 50, height: 20 });

    const rects = collectExcludeRects(root);

    expect(rects).toHaveLength(1);
    expect(rects).toContainEqual({ x: 5, y: 5, width: 50, height: 20 });
  });

  it('テキストが無くても操作要素 (button, a, input) は拾う', () => {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const input = document.createElement('input');
    root.appendChild(button);
    root.appendChild(input);
    document.body.appendChild(root);
    stubRect(button, { x: 1, y: 2, width: 44, height: 44 });
    stubRect(input, { x: 100, y: 2, width: 120, height: 32 });

    const rects = collectExcludeRects(root);

    expect(rects).toContainEqual({ x: 1, y: 2, width: 44, height: 44 });
    expect(rects).toContainEqual({ x: 100, y: 2, width: 120, height: 32 });
  });

  it('img 要素 (写真・ロゴ等) を拾う', () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    root.appendChild(img);
    document.body.appendChild(root);
    stubRect(img, { x: 0, y: 0, width: 300, height: 200 });

    const rects = collectExcludeRects(root);

    expect(rects).toContainEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('aria-hidden の部分木は丸ごと除外する (閉じたモバイルメニュー等)', () => {
    const root = document.createElement('div');
    const hidden = document.createElement('nav');
    hidden.setAttribute('aria-hidden', 'true');
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'リンク';
    hidden.appendChild(link);
    root.appendChild(hidden);
    document.body.appendChild(root);
    stubRect(hidden, { x: 0, y: 0, width: 400, height: 800 });
    stubRect(link, { x: 10, y: 10, width: 100, height: 20 });

    const rects = collectExcludeRects(root);

    expect(rects).toHaveLength(0);
  });

  it('サイズが 0 の要素は含めない', () => {
    const root = document.createElement('div');
    const empty = document.createElement('p');
    empty.textContent = '見えない';
    root.appendChild(empty);
    document.body.appendChild(root);
    stubRect(empty, { x: 0, y: 0, width: 0, height: 0 });

    const rects = collectExcludeRects(root);

    expect(rects).toHaveLength(0);
  });

  it('インライン要素を含む段落は、段落自身の地の文の矩形も拾う', () => {
    const root = document.createElement('div');
    const p = document.createElement('p');
    p.append('本文 ');
    const strong = document.createElement('strong');
    strong.textContent = '強調';
    p.append(strong, ' 続き');
    root.appendChild(p);
    document.body.appendChild(root);
    stubRect(p, { x: 0, y: 0, width: 200, height: 24 });
    stubRect(strong, { x: 40, y: 0, width: 40, height: 24 });

    const rects = collectExcludeRects(root);

    expect(rects).toContainEqual({ x: 0, y: 0, width: 200, height: 24 });
  });

  it('includeScrollOffset 指定時は window.scrollY を y へ加算する (本文・フッター用)', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(500);
    const root = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '本文';
    root.appendChild(p);
    document.body.appendChild(root);
    stubRect(p, { x: 10, y: 20, width: 100, height: 24 });

    const rects = collectExcludeRects(root, { includeScrollOffset: true });

    expect(rects).toContainEqual({ x: 10, y: 520, width: 100, height: 24 });
  });
});
