import React from 'react';

export interface IconProps {
  /** 既定は 24。装飾用途では aria-hidden を付与する */
  readonly size?: number;
  readonly className?: string;
}

// FILL は塗りつぶし版/線画版でアイコンごとに固定値が異なるため、共有クラス側ではなく
// ここで個々に inline style として上書きする
function renderIcon(
  ligature: string,
  fill: 0 | 1,
  testId: string,
  { size = 24, className }: IconProps,
) {
  return (
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
}

function createIcon(testId: string, ligature: string, fill: 0 | 1 = 0) {
  const Icon = (props: IconProps) => renderIcon(ligature, fill, testId, props);
  Icon.displayName = testId;
  return Icon;
}

/**
 * リガチャ名を直接指定する汎用アイコン。下部ナビゲーションのように項目定義側が
 * リガチャ名を文字列で持つ場合向けで、個別に named export を増やすほどではない用途に使う。
 */
export function MaterialIcon({
  name,
  ...props
}: IconProps & { readonly name: string }) {
  return renderIcon(name, 0, `icon-${name.replace(/_/g, '-')}`, props);
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
export const MailIcon = createIcon('icon-mail', 'mail');
export const OpenInNewIcon = createIcon('icon-open-in-new', 'open_in_new');
export const PauseIcon = createIcon('icon-pause', 'pause');
export const PlayArrowIcon = createIcon('icon-play-arrow', 'play_arrow');
export const CloseIcon = createIcon('icon-close', 'close');
export const DraftIcon = createIcon('icon-draft', 'draft');

// 位置ピン (地図上のマーカー) は同じ location_on の塗りつぶし版 (FILL 1) を使う
export const LocationPinIcon = createIcon(
  'icon-location-pin',
  'location_on',
  1,
);
