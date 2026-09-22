import React from 'react';

export interface IconProps {
  /** 既定は 24。装飾用途では aria-hidden を付与する */
  readonly size?: number;
  readonly className?: string;
}

// FILL は塗りつぶし版/線画版でアイコンごとに固定値が異なるため、共有クラス側ではなく
// ここで個々に inline style として上書きする
function createIcon(testId: string, ligature: string, fill: 0 | 1 = 0) {
  const Icon = ({ size = 24, className }: IconProps) => (
    <span
      aria-hidden="true"
      data-testid={testId}
      className={`material-symbols-sharp${className ? ` ${className}` : ''}`}
      style={{
        fontSize: size,
        lineHeight: `${size}px`,
        fontVariationSettings: `'FILL' ${fill}`,
      }}
    >
      {ligature}
    </span>
  );
  Icon.displayName = testId;
  return Icon;
}

export const PlaceIcon = createIcon('icon-place', 'location_on');
export const ShareIcon = createIcon('icon-share', 'share');
export const LinkIcon = createIcon('icon-link', 'link');
export const SearchIcon = createIcon('icon-search', 'search');
export const ChevronLeftIcon = createIcon('icon-chevron-left', 'chevron_left');
export const ChevronRightIcon = createIcon(
  'icon-chevron-right',
  'chevron_right',
);
export const ExpandMoreIcon = createIcon('icon-expand-more', 'expand_more');
export const HideImageIcon = createIcon('icon-hide-image', 'hide_image');
export const ImageIcon = createIcon('icon-image', 'image');
export const ArrowBackIcon = createIcon('icon-arrow-back', 'arrow_back');
export const MenuIcon = createIcon('icon-menu', 'menu');

// 位置ピン (地図上のマーカー) は同じ location_on の塗りつぶし版 (FILL 1) を使う
export const LocationPinIcon = createIcon(
  'icon-location-pin',
  'location_on',
  1,
);
