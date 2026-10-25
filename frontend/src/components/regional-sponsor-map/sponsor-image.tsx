'use client';

import { useEffect, useState } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorIcon } from './regional-sponsor-icon';

export interface SponsorImageProps {
  readonly sponsor: RegionalSponsor;
  readonly variant: 'card' | 'detail';
  readonly className?: string;
}

export function SponsorImage({
  sponsor,
  variant,
  className = '',
}: SponsorImageProps) {
  const [failed, setFailed] = useState(false);
  const url = toAssetUrl(sponsor.imageId, variant === 'card' ? 160 : 720);

  useEffect(() => setFailed(false), [url]);

  const commonClass = `flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 ${className}`;
  if (!url || failed) {
    return (
      <div
        className={commonClass}
        role={sponsor.imageDecorative ? undefined : 'img'}
        aria-label={
          sponsor.imageDecorative
            ? undefined
            : `${sponsor.name}の画像はありません`
        }
        aria-hidden={sponsor.imageDecorative || undefined}
        data-testid="sponsor-image-placeholder"
      >
        <RegionalSponsorIcon
          name="hide-image"
          size={30}
          className="text-gray-400"
        />
      </div>
    );
  }

  return (
    <div className={commonClass}>
      {/* CMS画像は同一IDを幅指定で取得し、広告文字を切らないため常にcontainで表示する。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={sponsor.imageDecorative ? '' : (sponsor.imageAlt ?? '')}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
