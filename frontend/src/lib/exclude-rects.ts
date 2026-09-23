import type { Rect } from './background-shapes';

const INTERACTIVE_SELECTOR =
  'a,button,input,select,textarea,[role="button"],[tabindex]';

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

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * 背景の図形装飾の除外領域 (design.md 「配置先」) の候補要素を集める。タグ名を
 * 列挙する方式だと将来のマークアップ変更で漏れるため、「操作要素・img・自身の直下に
 * テキストを持つ要素」という構造的な条件で判定する。aria-hidden の部分木
 * (閉じたモバイルメニュー等) は丸ごと除外する。
 *
 * 直下テキストの判定は子要素の有無を問わない。`<p>本文 <strong>強調</strong> 続き</p>`
 * のようにインライン要素を含むリッチテキストの段落では、p 自身も地の文を持つため
 * 拾わないと地の文の矩形が抜け落ちる。strong 側も別途拾われ重複するが実害はない
 */
function collectElements(root: Element): Element[] {
  const results: Element[] = [];

  const walk = (el: Element) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) {
      return;
    }
    if (!isVisible(el)) return;

    const interactive = el.matches(INTERACTIVE_SELECTOR);
    const image = el.tagName === 'IMG';
    const hasText = hasOwnText(el);

    if (interactive || image || hasText) {
      results.push(el);
    }
    // 操作要素の中の装飾用 span 等は個別に拾う必要が無いため潜らない
    if (interactive || image) return;

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
  return results;
}

/**
 * root 配下から除外領域の矩形一覧を求める。マージン (10px) はここでは付与せず
 * `computeBackgroundShapePlacement` 側で一括して加える。
 *
 * `includeScrollOffset` は本文・フッターの要素用。ヘッダーは position: fixed で
 * ビューポート先頭に固定されており、その座標が図形配置と同じ「ページ座標」の原点
 * (ヘッダー自身の高さの範囲) と一致するため scrollY を加えない
 */
export function collectExcludeRects(
  root: Element,
  options?: { includeScrollOffset?: boolean },
): Rect[] {
  const scrollY = options?.includeScrollOffset ? window.scrollY : 0;

  return collectElements(root)
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: rect.x,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
    }));
}
