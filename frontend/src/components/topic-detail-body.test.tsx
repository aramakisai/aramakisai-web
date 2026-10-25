import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicDetailBody } from './topic-detail-body';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:3100',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
  },
}));
vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => (id ? `https://example.com/${id}` : null),
}));

const topic = {
  id: 1,
  title: 'お知らせ',
  imageId: 'img1',
  body: '<p>本文</p>',
};

describe('TopicDetailBody', () => {
  it('signage は題名 title・本文 signage・写真は高さ512まで', () => {
    render(<TopicDetailBody topic={topic} variant="signage" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'text-signage-title',
      'leading-[40px]',
      'text-center',
    );
    expect(screen.getByAltText('お知らせ')).toHaveClass('max-h-[512px]');
    expect(screen.getByText('本文').parentElement).toHaveAttribute(
      'data-variant',
      'signage',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('site は従来の題名の大きさ', () => {
    render(<TopicDetailBody topic={topic} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'lg:text-[32px]',
    );
  });
});
