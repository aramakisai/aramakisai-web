import '@testing-library/jest-dom/vitest';

// jsdom は Range.getClientRects/getBoundingClientRect を実装していない
// (呼ぶと "is not a function" で例外になる)。obstacles.ts のグリフ範囲取得が
// 動くよう、コンテナ要素の getBoundingClientRect で代用するフォールバックを
// feature-detect 付きで補う (本物のブラウザでは何もしない)
if (
  typeof Range !== 'undefined' &&
  typeof Range.prototype.getClientRects !== 'function'
) {
  Range.prototype.getClientRects = function (this: Range) {
    const node = this.startContainer;
    const el = (
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
    ) as Element | null;
    const rects = el ? [el.getBoundingClientRect()] : [];
    return Object.assign(rects, {
      item: (i: number) => rects[i] ?? null,
    }) as unknown as DOMRectList;
  };
}
