import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SignageLostItem, SponsorRow } from '@/lib/signage';
import { ImageSlide } from './image';
import { LostItemsSlide } from './lost-items';
import { SponsorsSlide } from './sponsors';

vi.mock('@/lib/cms-asset-url', () => ({
  toCardImageUrl: (a: { id: string }) => `https://cms.test/${a.id}`,
  toHeroImage: (a: { id: string }) => ({ src: `https://cms.test/${a.id}` }),
}));

describe('SponsorsSlide', () => {
  it('ロゴ行はロゴと社名、社名行は社名だけを出す', () => {
    const rows: SponsorRow[] = [
      {
        kind: 'logo',
        tier: 'planA',
        items: [
          {
            id: 1,
            name: '協賛A',
            logoId: 'l1',
            logo: { id: 'l1' },
            tier: 'planA',
          },
        ],
      },
      {
        kind: 'names',
        items: [{ id: 2, name: '協賛D', logoId: null, tier: 'planD' }],
      },
    ];
    render(<SponsorsSlide rows={rows} />);
    expect(screen.getByRole('img', { name: '協賛A' })).toHaveAttribute(
      'src',
      'https://cms.test/l1',
    );
    expect(screen.getByText('協賛D')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('ご協賛いただいた皆さま')).toBeInTheDocument();
  });
});

describe('LostItemsSlide', () => {
  const item = (over: Partial<SignageLostItem>): SignageLostItem => ({
    id: 1,
    name: '黒い長財布',
    foundPlace: '本部',
    foundAt: '2026-11-02T06:41:00.000Z',
    photoId: null,
    ...over,
  });

  it('品名・拾得場所と時刻・案内文を出し、写真なしは画像を出さない', () => {
    render(<LostItemsSlide items={[item({})]} />);
    expect(screen.getByText('黒い長財布')).toBeInTheDocument();
    expect(screen.getByText('本部｜15:41')).toBeInTheDocument();
    expect(screen.getByText('本部テントでお預かりしています')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('写真ありは画像を出す', () => {
    const { container } = render(
      <LostItemsSlide
        items={[
          item({
            photoId: 'p1',
            photo: { id: 'p1' },
          }),
        ]}
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cms.test/p1',
    );
  });
});

describe('ImageSlide', () => {
  const image = {
    id: 'a1',
    filenameDownload: 'a.png',
    type: 'image/png',
    filesize: 1,
  };

  it('登録画像を出し、見出しチップは出さない', () => {
    const { container } = render(<ImageSlide image={image} />);
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cms.test/a1',
    );
    expect(screen.queryByText('構内マップ')).toBeNull();
  });
});
