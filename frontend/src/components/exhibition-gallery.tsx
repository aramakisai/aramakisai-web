'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { toAssetUrl, toCardImageUrl, toHeroImage } from '@/lib/cms-asset-url';
import type { ExhibitionImage } from '@/lib/exhibitions';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { CrossFade } from './cross-fade';
import { HideImageIcon } from './icons';
import {
  ImageViewerDialog,
  type ImageViewerHandle,
} from './image-viewer-dialog';

export interface ExhibitionGalleryProps {
  readonly images: readonly ExhibitionImage[];
  readonly fallbackAlt: string;
  readonly enlargeable?: boolean;
}

const AUTO_ADVANCE_MS = 5000;

const FRAME_CLASS =
  'relative aspect-[4/3] w-full overflow-clip rounded-xl bg-gray-200';

export function ExhibitionGallery({
  images,
  fallbackAlt,
  enlargeable = false,
}: ExhibitionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const viewerRef = useRef<ImageViewerHandle>(null);
  const { reduced } = useMotionPreference();
  const count = images.length;

  // selectedIndex を依存に含めるため、手動選択でも次回切替が 5 秒後に仕切り直される
  useEffect(() => {
    if (count < 2 || paused || viewerOpen || reduced) return;
    const timer = setTimeout(
      () => setSelectedIndex((i) => (i + 1) % count),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [count, paused, viewerOpen, reduced, selectedIndex]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gray-200">
        <HideImageIcon size={64} className="text-gray-400" />
        <span className="sr-only">{fallbackAlt}: 画像がありません</span>
      </div>
    );
  }

  const selected = images[selectedIndex] ?? images[0]!;
  const selectedAlt = selected.alt || fallbackAlt;

  // aspect-ratio の箱は自動最小高さが中身の高さになり、縦長画像で枠が伸びる。
  // img を absolute にして中身の高さを枠の計算から外す
  const mainFrame = (
    <CrossFade
      transitionKey={selected.id}
      enabled={!reduced}
      className="absolute inset-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]"
      layerClassName="bg-gray-200"
    >
      <img
        src={toHeroImage(selected)?.src}
        alt={selectedAlt}
        decoding="async"
        fetchPriority="high"
        className="h-full w-full object-contain"
      />
    </CrossFade>
  );

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
      {enlargeable ? (
        <button
          type="button"
          aria-label={`画像を拡大: ${selectedAlt}`}
          onClick={(e) => {
            setViewerOpen(true);
            viewerRef.current?.open(
              { src: toAssetUrl(selected.id) ?? '', alt: selectedAlt },
              e.currentTarget,
            );
          }}
          className={`hover-card-shadow ${FRAME_CLASS}`}
        >
          {mainFrame}
        </button>
      ) : (
        <div className={FRAME_CLASS}>{mainFrame}</div>
      )}
      {/* overflow-x-auto は縦方向も clip するため、サムネイルの影 (下 40px・左右 20px) が収まる余白を負マージンで相殺して確保する */}
      {images.length > 1 && (
        <div className="-mx-6 -mb-10 flex gap-2 overflow-x-auto px-6 pb-10">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={image.alt || fallbackAlt}
              aria-pressed={index === selectedIndex}
              onClick={() => setSelectedIndex(index)}
              className={`hover-card-shadow h-12 w-16 shrink-0 overflow-hidden rounded-md bg-gray-200 ${
                index === selectedIndex ? 'border-[3px] border-primary' : ''
              }`}
            >
              <img
                src={toCardImageUrl(image) ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {enlargeable && (
        <ImageViewerDialog
          ref={viewerRef}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
