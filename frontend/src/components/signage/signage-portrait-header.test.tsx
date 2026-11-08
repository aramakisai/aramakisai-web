import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CampusMapArea } from '@/lib/campus-map';
import { SignagePortraitHeader } from './signage-portrait-header';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

const now = new Date('2026-11-01T05:17:00Z');
const eventDays = [
  {
    label: null,
    startAt: '2026-11-01T00:00:00Z',
    endAt: '2026-11-01T10:00:00Z',
  },
];
const area = (name: string): CampusMapArea => ({
  id: 1,
  name,
  geometry: { type: 'MultiPolygon', coordinates: [] },
  color: '#000000',
  hasAed: false,
  hasToilet: false,
});

describe('SignagePortraitHeader 現在地ラベル', () => {
  it('設置エリアがあればラベルが開催日より前に並び、43px 空けて上下中央にそろう', () => {
    render(
      <SignagePortraitHeader
        now={now}
        eventDays={eventDays}
        installArea={area('1号館')}
      />,
    );
    const label = screen.getByText('現在地').closest('div.rounded-full');
    const row = label!.parentElement!;
    expect(row).toHaveClass('flex', 'items-center', 'gap-[43px]');
    expect(row.firstElementChild).toBe(label);
    expect(row.lastElementChild).toContainElement(screen.getByText(/DAY/));
  });

  it('エリア名が長くても折り返さず開催日の左に付いたまま', () => {
    render(
      <SignagePortraitHeader
        now={now}
        eventDays={eventDays}
        installArea={area('武道館ステージ')}
      />,
    );
    expect(screen.getByText('武道館ステージ').parentElement).toHaveClass(
      'whitespace-nowrap',
    );
  });

  it('設置エリアが無ければラベルは出ない', () => {
    render(<SignagePortraitHeader now={now} eventDays={eventDays} />);
    expect(screen.queryByText('現在地')).toBeNull();
  });
});
