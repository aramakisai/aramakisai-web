'use client';

import { createContext, useEffect, useState } from 'react';
import { SPONSOR_NAME_FONT_PX, type MeasureText } from './signage-sponsor-name';

/** undefined の間は全角幅の概算。フォント読込前の計測で行数がずれるのを避けるため、fonts.ready 後に実フォントへ切り替える */
export const SponsorMeasureContext = createContext<MeasureText | undefined>(
  undefined,
);

export function useSponsorMeasure(): MeasureText | undefined {
  const [measure, setMeasure] = useState<MeasureText>();
  useEffect(() => {
    let cancelled = false;
    // jsdom には document.fonts が無い
    void document.fonts?.ready.then(() => {
      if (cancelled) return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      const body = getComputedStyle(document.body);
      ctx.font = `${SPONSOR_NAME_FONT_PX}px ${body.fontFamily}`;
      // body の letter-spacing は DOM の文字幅に乗るが canvas は既定で 0
      ctx.letterSpacing = body.letterSpacing;
      setMeasure(() => (text: string) => ctx.measureText(text).width);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return measure;
}
