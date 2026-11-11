'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const ELLIPSIS = '…';
// 小数の行高 (1.2 × 28px など) の丸め誤差で、ちょうど収まる行数を溢れ扱いにしないための許容
const EPSILON = 0.5;

/** fits が単調 (n が小さいほど true になりやすい) なとき、fits(n) を満たす最大の n (0〜total) */
export function fitPrefixLength(
  total: number,
  fits: (n: number) => boolean,
): number {
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface SignageClampedTextProps {
  readonly text: string;
  readonly lines: number;
  readonly className?: string;
}

/**
 * 行高 1.2 では 2 行目のディセンダーと 3 行目の上端が縦に重なるため、overflow や line-clamp の
 * 切り取りでは「最終行を欠けさせない」と「溢れた行を見せない」を両立できない。
 * 文字列自体を行数に収まる長さまで切り詰めて「…」を付ける。
 */
export function SignageClampedText({
  text,
  lines,
  className = '',
}: SignageClampedTextProps) {
  const pRef = useRef<HTMLParagraphElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);

  useLayoutEffect(() => {
    const p = pRef.current;
    const m = measureRef.current;
    if (!p || !m) return;
    let cancelled = false;
    const recompute = () => {
      if (cancelled) return;
      const limit = lines * parseFloat(getComputedStyle(p).lineHeight);
      const fitsText = (t: string) => {
        m.textContent = t;
        // キャンバスの縮小 transform を受ける getBoundingClientRect ではなく、レイアウト上の高さで測る
        return m.offsetHeight <= limit + EPSILON;
      };
      // 行高を数値で取れない環境 (計測できない) では切り詰めない
      if (!Number.isFinite(limit) || fitsText(text)) {
        setShown(text);
      } else {
        const n = fitPrefixLength(text.length, (k) =>
          fitsText(text.slice(0, k).trimEnd() + ELLIPSIS),
        );
        setShown(text.slice(0, n).trimEnd() + ELLIPSIS);
      }
      m.textContent = '';
    };
    recompute();
    void document.fonts?.ready.then(recompute);
    const ro = new ResizeObserver(recompute);
    ro.observe(p);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [text, lines]);

  return (
    <p
      ref={pRef}
      className={`relative ${className}`}
      style={{ overflow: 'visible' }}
    >
      <span
        ref={measureRef}
        aria-hidden
        className="invisible absolute inset-x-0 top-0 block"
      />
      {shown}
    </p>
  );
}
