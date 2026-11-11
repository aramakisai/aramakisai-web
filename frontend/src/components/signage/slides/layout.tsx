'use client';

import { useEffect, useRef, useState } from 'react';
import { RichText } from '@/components/rich-text';
import { slideLeaveDelayMs } from '@/lib/signage-stage-notice-shapes';
import { NoticeShapeLayer } from '../signage-stage-notice';

const SLIDE_BPM = 100;

export type SlideLayout =
  'title' | 'title-content' | 'section' | 'two-content' | 'logo';
export type SlideTone = 'normal' | 'alert';

export interface LayoutSlideProps {
  layout: SlideLayout;
  tone: SlideTone;
  title: string;
  subtext: string | null;
  content1Html: string;
  content2Html: string;
  animated?: boolean;
  durationSec?: number;
  /** スライド内の経過ms。退場の予約にマウント時の値だけ使う */
  elapsedMs?: number;
  /** 巡回上の直前・直後が animated な layout か。前なら入場せず、後なら退場しない */
  prevAnimated?: boolean;
  nextAnimated?: boolean;
}

// 本文枠はサイネージ用スタイルで描き、はみ出しは枠の overflow で切る
function ContentFrame({ html, half }: { html: string; half: boolean }) {
  return (
    <div className="h-full min-w-0 flex-1 overflow-hidden">
      <RichText
        html={html}
        className={`rich-text-body--signage${half ? ' rich-text-body--half' : ''}`}
      />
    </div>
  );
}

export function LayoutSlide({
  layout,
  tone,
  title,
  subtext,
  content1Html,
  content2Html,
  animated = false,
  durationSec = 0,
  elapsedMs = 0,
  prevAnimated = false,
  nextAnimated = false,
}: LayoutSlideProps) {
  const [settled] = useState(prevAnimated);
  const [leaving, setLeaving] = useState(false);
  // 退場の窓は now の毎秒更新では取りこぼすため、マウント時の経過から一度だけ予約する
  const mountElapsed = useRef(elapsedMs);
  useEffect(() => {
    if (!animated || nextAnimated) return;
    const wait = slideLeaveDelayMs(durationSec, mountElapsed.current);
    if (wait <= 0) {
      setLeaving(true);
      return;
    }
    const timer = setTimeout(() => setLeaving(true), wait);
    return () => clearTimeout(timer);
  }, [animated, nextAnimated, durationSec]);

  const bg = tone === 'alert' ? 'bg-warning' : 'bg-white';
  const text = '[word-break:auto-phrase] overflow-hidden text-text';
  let body: React.ReactNode;

  if (layout === 'logo') {
    body = (
      <div className="flex flex-1 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-logo=""
          src="/images/aramakisai2026_line.svg"
          alt="荒牧祭 ARAMAKI-Fes. 2026"
          width={772}
          className="w-[772px] max-w-none"
        />
      </div>
    );
  } else if (layout === 'title') {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <p
          className={`line-clamp-2 w-full text-[96px] leading-[1.1] font-black ${text}`}
        >
          {title}
        </p>
        {subtext && (
          <p
            className={`line-clamp-2 w-full text-[40px] leading-[1.3] font-bold ${text}`}
          >
            {subtext}
          </p>
        )}
      </div>
    );
  } else if (layout === 'section') {
    body = (
      <div className="flex flex-1 flex-col gap-6 pt-[282px]">
        <p
          className={`line-clamp-2 w-full text-[96px] leading-[1.1] font-black ${text}`}
        >
          {title}
        </p>
        {subtext && (
          <p
            className={`line-clamp-3 w-full text-[36px] leading-[1.4] font-bold ${text}`}
          >
            {subtext}
          </p>
        )}
      </div>
    );
  } else {
    const two = layout === 'two-content';
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <p
          className={`line-clamp-1 w-full text-[64px] leading-[1.2] font-black ${text}`}
        >
          {title}
        </p>
        <div className="flex min-h-0 flex-1 gap-12">
          <ContentFrame html={content1Html} half={two} />
          {two && <ContentFrame html={content2Html} half />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-[864px] w-[1536px] flex-col overflow-hidden rounded-2xl p-16 font-display ${bg}`}
    >
      {animated && (
        <NoticeShapeLayer bpm={SLIDE_BPM} leaving={leaving} settled={settled} />
      )}
      {animated ? (
        <div className="relative flex min-h-0 flex-1 flex-col">{body}</div>
      ) : (
        body
      )}
    </div>
  );
}
