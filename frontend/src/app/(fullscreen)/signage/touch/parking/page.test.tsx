import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TouchParkingPage, { dynamic } from './page';
import { getParkingResponse } from '@/lib/parking-data';

vi.mock('@/lib/parking-data', () => ({ getParkingResponse: vi.fn() }));

describe('TouchParkingPage', () => {
  it('毎リクエスト描画し、カードを出す', async () => {
    expect(dynamic).toBe('force-dynamic');
    vi.mocked(getParkingResponse).mockResolvedValue({
      ok: true,
      value: {
        isEventDay: true,
        fetchedAt: '2026-10-24T04:42:00Z',
        lots: [
          {
            id: 1,
            name: '正門前駐車場',
            status: 'available',
            updatedAt: '2026-10-24T04:40:00Z',
          },
        ],
      },
    } as never);
    render(await TouchParkingPage());
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
  });
});
