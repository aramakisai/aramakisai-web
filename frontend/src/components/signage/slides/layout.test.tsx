import { render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { LayoutSlide } from './layout';

vi.mock('@/lib/cms-asset-url', () => ({ toAssetUrl: () => null }));

const base = {
  tone: 'normal' as const,
  title: 'タイトル',
  subtext: 'サブ',
  content1Html: '<p>one</p>',
  content2Html: '<p>two</p>',
};

describe('LayoutSlide', () => {
  test('title はタイトル2行・サブ2行で省略する', () => {
    const { container } = render(<LayoutSlide {...base} layout="title" />);
    expect(container.querySelector('.line-clamp-2')).toHaveTextContent(
      'タイトル',
    );
    expect(container.querySelectorAll('.line-clamp-2')).toHaveLength(2);
  });

  test('section はサブ3行', () => {
    const { container } = render(<LayoutSlide {...base} layout="section" />);
    expect(container.querySelector('.line-clamp-3')).toHaveTextContent('サブ');
  });

  test('title-content は本文1枠(全幅)、two-content は2枠(半幅)', () => {
    const one = render(<LayoutSlide {...base} layout="title-content" />);
    expect(
      one.container.querySelectorAll('.rich-text-body--signage'),
    ).toHaveLength(1);
    expect(one.container.querySelector('.rich-text-body--half')).toBeNull();
    const two = render(<LayoutSlide {...base} layout="two-content" />);
    expect(
      two.container.querySelectorAll('.rich-text-body--half'),
    ).toHaveLength(2);
  });

  test('alert は警告色の地', () => {
    const { container } = render(
      <LayoutSlide {...base} layout="title" tone="alert" />,
    );
    expect(container.firstElementChild).toHaveClass('bg-warning');
  });
});
