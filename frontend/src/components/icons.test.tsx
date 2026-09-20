import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ArrowBackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HideImageIcon,
  LinkIcon,
  LocationPinIcon,
  PlaceIcon,
  SearchIcon,
  ShareIcon,
} from './icons';

const icons = [
  ['icon-place', PlaceIcon],
  ['icon-share', ShareIcon],
  ['icon-link', LinkIcon],
  ['icon-search', SearchIcon],
  ['icon-chevron-left', ChevronLeftIcon],
  ['icon-chevron-right', ChevronRightIcon],
  ['icon-hide-image', HideImageIcon],
  ['icon-arrow-back', ArrowBackIcon],
  ['icon-location-pin', LocationPinIcon],
] as const;

describe('icons', () => {
  it.each(icons)(
    '%s は装飾要素として読み上げから除外される',
    (testId, Icon) => {
      render(<Icon />);
      const svg = screen.getByTestId(testId);
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('fill', 'currentColor');
    },
  );

  it('既定サイズは 24 で、size と className を上書きできる', () => {
    const { rerender } = render(<PlaceIcon />);
    expect(screen.getByTestId('icon-place')).toHaveAttribute('width', '24');

    rerender(<PlaceIcon size={32} className="text-red-500" />);
    const svg = screen.getByTestId('icon-place');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg).toHaveClass('text-red-500');
  });

  it('LocationPinIcon は fill="currentColor" のため呼び出し側の className で着色できる', () => {
    render(<LocationPinIcon className="text-accent" />);
    const svg = screen.getByTestId('icon-location-pin');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveClass('text-accent');
  });
});
