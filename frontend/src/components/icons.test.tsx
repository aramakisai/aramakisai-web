import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ArrowBackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExpandMoreIcon,
  HideImageIcon,
  ImageIcon,
  LinkIcon,
  LocationPinIcon,
  MenuIcon,
  PlaceIcon,
  SearchIcon,
  ShareIcon,
} from './icons';

const icons = [
  ['icon-place', PlaceIcon, 'location_on'],
  ['icon-share', ShareIcon, 'share'],
  ['icon-link', LinkIcon, 'link'],
  ['icon-search', SearchIcon, 'search'],
  ['icon-chevron-left', ChevronLeftIcon, 'chevron_left'],
  ['icon-chevron-right', ChevronRightIcon, 'chevron_right'],
  ['icon-expand-more', ExpandMoreIcon, 'expand_more'],
  ['icon-hide-image', HideImageIcon, 'hide_image'],
  ['icon-image', ImageIcon, 'image'],
  ['icon-arrow-back', ArrowBackIcon, 'arrow_back'],
  ['icon-menu', MenuIcon, 'menu'],
  ['icon-location-pin', LocationPinIcon, 'location_on'],
] as const;

describe('icons', () => {
  it.each(icons)(
    '%s は Material Symbols Sharp のリガチャ名 %s を描画し、装飾要素として読み上げから除外される',
    (testId, Icon, ligature) => {
      render(<Icon />);
      const icon = screen.getByTestId(testId);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveClass('material-symbols-sharp');
      expect(icon).toHaveTextContent(ligature);
    },
  );

  it('既定サイズは 24 で、size と className を上書きできる', () => {
    const { rerender } = render(<PlaceIcon />);
    expect(screen.getByTestId('icon-place')).toHaveStyle({ fontSize: '24px' });

    rerender(<PlaceIcon size={32} className="text-red-500" />);
    const icon = screen.getByTestId('icon-place');
    expect(icon).toHaveStyle({ fontSize: '32px' });
    expect(icon).toHaveClass('text-red-500');
  });

  it('色は currentColor 相当で呼び出し側の className で着色できる (fill/stroke を持たないテキスト描画のため)', () => {
    render(<PlaceIcon className="text-accent" />);
    expect(screen.getByTestId('icon-place')).toHaveClass('text-accent');
  });

  it('LocationPinIcon は同じ location_on を塗りつぶし版 (FILL 1) で描画する', () => {
    render(<LocationPinIcon />);
    expect(screen.getByTestId('icon-location-pin')).toHaveStyle({
      fontVariationSettings: "'FILL' 1",
    });
    expect(PlaceIcon).not.toBe(LocationPinIcon);
  });
});
