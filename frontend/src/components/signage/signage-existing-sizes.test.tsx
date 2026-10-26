import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignageLeftColumn } from './signage-left-column';
import { LostItemsSlide } from './slides/lost-items';
import { ParkingSlide } from './slides/parking-slide';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => (id ? `https://cms.test/${id}` : null),
}));

vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

describe('待機中サイネージの文字の大きさ', () => {
  it('落とし物の品名は28', () => {
    render(
      <LostItemsSlide
        items={[
          {
            id: 1,
            name: '黒い長財布',
            foundPlace: '本部',
            foundAt: '2026-11-02T06:41:00.000Z',
            photoId: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('黒い長財布')).toHaveClass('text-[28px]');
  });

  it('いまのステージの企画名は28', () => {
    render(
      <SignageLeftColumn
        now={new Date('2026-11-02T05:00:00Z')}
        eventDays={[]}
        rows={[
          {
            stage: { id: 1, name: 'メインステージ' },
            colorIndex: 0,
            performance: {
              id: 1,
              stageId: 1,
              name: 'ダンスサークル',
              href: null,
              slot: {
                dateKey: '2026-11-02',
                startAt: '2026-11-02T04:00:00Z',
                endAt: '2026-11-02T06:00:00Z',
              },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText('ダンスサークル')).toHaveClass('text-[28px]');
  });

  it('駐車場の状態は32', () => {
    render(
      <ParkingSlide
        parking={{
          isEventDay: true,
          fetchedAt: '2026-11-14T05:10:00Z',
          lots: [
            {
              id: 1,
              name: 'P5',
              status: 'available',
              updatedAt: '2026-11-14T05:05:00Z',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('空き')).toHaveClass('text-[32px]');
  });
});
