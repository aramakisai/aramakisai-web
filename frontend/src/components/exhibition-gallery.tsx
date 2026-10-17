'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionImage } from '@/lib/exhibitions';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { CrossFade } from './cross-fade';
import { HideImageIcon } from './icons';

export interface ExhibitionGalleryProps {
  readonly images: readonly ExhibitionImage[];
  readonly fallbackAlt: string;
}

const AUTO_ADVANCE_MS = 5000;

export function ExhibitionGallery({
  images,
  fallbackAlt,
}: ExhibitionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { reduced } = useMotionPreference();
  const count = images.length;

  // selectedIndex を依存に含めるため、手動選択でも次回切替が 5 秒後に仕切り直される
  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const timer = setTimeout(
      () => setSelectedIndex((i) => (i + 1) % count),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [count, paused, reduced, selectedIndex]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gray-200">
        <HideImageIcon size={64} className="text-gray-400" />
        <span className="sr-only">{fallbackAlt}: 画像がありません</span>
      </div>
    );
  }

  const selected = images[selectedIndex] ?? images[0]!;

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {/* aspect-ratio の箱は自動最小高さが中身の高さになり、縦長画像で枠が伸びる。
          img を absolute にして中身の高さを枠の計算から外す */}
      <div className="relative aspect-[4/3] w-full overflow-clip rounded-xl bg-gray-200">
        <CrossFade
          transitionKey={selected.id}
          enabled={!reduced}
          className="absolute inset-0"
          layerClassName="bg-gray-200"
        >
          <img
            src={toAssetUrl(selected.id, 1920) ?? undefined}
            alt={selected.alt || fallbackAlt}
            className="h-full w-full object-contain"
          />
        </CrossFade>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={image.alt || fallbackAlt}
              aria-pressed={index === selectedIndex}
              onClick={() => setSelectedIndex(index)}
              className={`h-12 w-16 shrink-0 overflow-hidden rounded-md bg-gray-200 ${
                index === selectedIndex ? 'border-[3px] border-primary' : ''
              }`}
            >
              <img
                src={toAssetUrl(image.id, 960) ?? undefined}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
