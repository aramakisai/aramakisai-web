'use client';

import { useEffect } from 'react';

const EDITABLE =
  'input,textarea,[contenteditable]:not([contenteditable="false"])';

const ZWSP = '\u200B';
const WJ = '\u2060';
// アイコンフォントはテキストが合字で描画されるため、WJ を挟むと崩れる
const SKIP = `${EDITABLE},script,style,.material-symbols-sharp`;

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

// 句内の書記素間に WORD JOINER を入れ、ZWSP だけを改行位置にする。
// 結合文字・絵文字連結列の途中には入れない
export function joinWithinPhrases(text: string): string {
  let out = '';
  let prev = '';
  for (const { segment } of segmenter.segment(text)) {
    const a = prev.slice(-1);
    const b = segment[0];
    if (
      prev &&
      a !== ZWSP &&
      b !== ZWSP &&
      a !== WJ &&
      b !== WJ &&
      !/\s/.test(a) &&
      !/\s/.test(b)
    )
      out += WJ;
    out += segment;
    prev = segment;
  }
  return out;
}

function textNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.parentElement?.closest(SKIP)) nodes.push(n as Text);
  }
  return nodes;
}

// WebKit の word-break: keep-all は開き括弧の前の ZWSP を改行位置に使わず、
// 括弧の直後で折ってしまう。budoux が付ける keep-all を normal に戻し、
// 句内に WJ を入れて禁則を保ったまま句の境界(ZWSP)でだけ折れるようにする。
// テキストノードは分割せず nodeValue だけ書き換え、React の差分適用を壊さない
function applyPhrases(
  el: HTMLElement,
  parser: { applyToElement: (e: HTMLElement) => void },
) {
  // 自分が挿入した文字を BudouX の入力に混ぜない
  for (const t of textNodes(el)) {
    const v = t.nodeValue ?? '';
    if (v.includes(WJ) || v.includes(ZWSP))
      t.nodeValue = v.replaceAll(WJ, '').replaceAll(ZWSP, '');
  }
  parser.applyToElement(el);
  for (const e of [el, ...el.querySelectorAll<HTMLElement>('[style]')]) {
    if (e.style.wordBreak === 'keep-all') e.style.wordBreak = 'normal';
  }
  for (const t of textNodes(el)) {
    const v = t.nodeValue ?? '';
    const next = joinWithinPhrases(v);
    if (next !== v) t.nodeValue = next;
  }
}

// word-break: auto-phrase は Chromium 系のみ対応。未対応ブラウザにだけ budoux で
// ZWSP を挿入して文節改行を補う。<wbr> を渡すとテキストノードが分割され
// React の差分適用が壊れるため、区切りは ZWSP のままにする
export function PhraseLineBreak() {
  useEffect(() => {
    if (CSS.supports('word-break', 'auto-phrase')) return;

    let observer: MutationObserver | undefined;
    let cancelled = false;

    void import('budoux').then(({ loadDefaultJapaneseParser }) => {
      if (cancelled) return;
      const parser = loadDefaultJapaneseParser();
      const OBSERVE = {
        childList: true,
        subtree: true,
        characterData: true,
      };

      const pending = new Set<HTMLElement>();

      // 自分の書き換えを再検知して無限ループしないよう、適用中は監視を止める
      const apply = (targets: Iterable<HTMLElement>) => {
        observer?.disconnect();
        for (const el of targets) {
          if (el.isConnected && !el.closest(SKIP)) applyPhrases(el, parser);
        }
        observer?.observe(document.body, OBSERVE);
      };

      observer = new MutationObserver((records) => {
        if (pending.size === 0) {
          queueMicrotask(() => {
            const targets = [...pending];
            pending.clear();
            apply(targets);
          });
        }
        for (const r of records) {
          if (r.type === 'characterData') {
            if (r.target.parentElement) pending.add(r.target.parentElement);
          } else if (r.target instanceof HTMLElement) {
            pending.add(r.target);
          }
        }
      });

      apply([document.body]);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
