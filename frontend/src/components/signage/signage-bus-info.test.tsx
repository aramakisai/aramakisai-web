import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { DirectionBoard, NextDeparture } from '@/lib/bus-next-departures';
import { SignageBusInfo } from './signage-bus-info';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));
vi.mock('@/lib/cms', () => ({ cms: {} }));

const dep = (p: Partial<NextDeparture> = {}): NextDeparture => ({
  route: '22B',
  destination: '前橋駅',
  via: null,
  stopName: '群馬大学荒牧',
  scheduledAt: '14:20',
  expectedAt: '14:20',
  delayMinutes: 0,
  source: 'schedule',
  minutesLeft: 3,
  ...p,
});

const boards = (
  maebashi: NextDeparture[],
  shibukawa: NextDeparture[],
): DirectionBoard[] => [
  { direction: 'maebashi', departures: maebashi },
  { direction: 'shibukawa', departures: shibukawa },
];

describe('SignageBusInfo', () => {
  test('定刻の便は発車時刻・系統・行先・のりば・発車までを出し、遅れは出さない', () => {
    render(
      <SignageBusInfo
        boards={boards(
          [dep()],
          [dep({ route: '22A', destination: '渋川駅', scheduledAt: '14:40' })],
        )}
      />,
    );
    expect(screen.getAllByTestId('bus-departure-row')).toHaveLength(2);
    expect(screen.getByText('14:20')).toBeTruthy();
    expect(screen.getByText('渋川駅')).toBeTruthy();
    expect(screen.getAllByText('3分')).toHaveLength(2);
    expect(screen.getAllByText('群馬大学荒牧 発')).toHaveLength(2);
    expect(screen.queryByText(/遅れ/)).toBeNull();
  });

  test('遅れは定刻の発車時刻のまま「約N分遅れ」を出す', () => {
    render(
      <SignageBusInfo
        boards={boards(
          [dep({ delayMinutes: 5, expectedAt: '14:25', minutesLeft: 8 })],
          [],
        )}
      />,
    );
    expect(screen.getByText('14:20')).toBeTruthy();
    expect(screen.getByText('8分')).toBeTruthy();
    expect(screen.getByText('約5分遅れ')).toBeTruthy();
  });

  test('minutesLeft が 0 なら「まもなく」', () => {
    render(
      <SignageBusInfo
        boards={boards([dep({ minutesLeft: 0, delayMinutes: 5 })], [])}
      />,
    );
    expect(screen.getByText('まもなく')).toBeTruthy();
    expect(screen.getByText('約5分遅れ')).toBeTruthy();
  });

  test('全便発車済みの方面は運行終了の行を出す', () => {
    render(<SignageBusInfo boards={boards([dep()], [])} />);
    expect(screen.getAllByTestId('bus-departure-row')).toHaveLength(1);
    expect(screen.getAllByTestId('bus-departure-ended')).toHaveLength(1);
    expect(screen.getByText('本日の運行は終了しました')).toBeTruthy();
  });

  test('枠の下端に短い出典を出す', () => {
    render(<SignageBusInfo boards={boards([], [])} />);
    expect(
      screen.getByText(
        'データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター',
      ),
    ).toBeTruthy();
  });
});
