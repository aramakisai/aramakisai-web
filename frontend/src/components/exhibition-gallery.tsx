'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionImage } from '@/lib/exhibitions';
import { HideImageIcon } from './icons';

export interface ExhibitionGalleryProps {
  readonly images: readonly ExhibitionImage[];
  readonly fallbackAlt: string;
}

export function ExhibitionGallery({
  images,
  fallbackAlt,
}: ExhibitionGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    <div className="flex flex-col gap-3">
      {/* img 自身に aspect-ratio を付けると flex item の min-height:auto が画像の固有高さを採り、
          縦長画像で 4:3 が崩れる。比率は枠側で固定し、画像は枠内に収める */}
      <div className="aspect-[4/3] w-full overflow-clip rounded-xl bg-gray-200">
        <img
          src={toAssetUrl(selected.id, 1920) ?? undefined}
          alt={selected.alt || fallbackAlt}
          className="h-full w-full object-contain"
        />
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
