// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:3100',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
  },
}));

import type { SignageSnapshot } from '@/lib/signage';

const seen = vi.hoisted(() => ({
  main: [] as Record<string, unknown>[],
  header: [] as Record<string, unknown>[],
  touch: [] as Record<string, unknown>[],
}));
vi.mock('./signage-main', () => ({
  SignageMain: (p: Record<string, unknown>) => (seen.main.push(p), null),
}));
vi.mock('./signage-portrait-header', () => ({
  SignagePortraitHeader: (p: Record<string, unknown>) => (
    seen.header.push(p),
    null
  ),
}));
vi.mock('./signage-touch-layer', () => ({
  SignageTouchLayer: (p: Record<string, unknown>) => (seen.touch.push(p), null),
}));
vi.mock('@/lib/use-signage-channel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-signage-channel')>()),
  useSignageChannel: () => ({
    pin: undefined,
    snapshotVersion: undefined,
    latest: {},
  }),
}));
vi.mock('@/lib/use-bus-realtime', () => ({ useBusRealtime: () => null }));

import { SignageScreen } from './signage-screen';

const area = (id: number, name: string) => ({
  id,
  name,
  geometry: { type: 'MultiPolygon', coordinates: [] },
  color: '#fff',
  hasAed: false,
  hasToilet: false,
});
const snapshot = {
  fetchedAt: '',
  serverNow: '2026-11-14T00:00:00Z',
  trialShiftMs: null,
  pinnedSlideId: null,
  eventDays: [],
  slides: [],
  quakeSlides: { warning: null, calm: null, evacuate: null, cancelled: null },
  telops: [],
  timetable: { days: [], stages: [], performances: [] },
  sponsors: [],
  lostItems: [],
  campusMap: { areas: [area(12, '第一体育館'), area(3, '広場')], points: [] },
  parking: { isEventDay: false, fetchedAt: '', lots: [] },
} as unknown as SignageSnapshot;

function installAreaFor(mapArea: string | null) {
  seen.main.length = seen.header.length = seen.touch.length = 0;
  render(
    <SignageScreen
      initial={snapshot}
      renderedAt="2026-11-14T00:00:00Z"
      mapArea={mapArea}
    />,
  );
  return {
    main: seen.main.at(-1)?.installArea,
    header: seen.header.at(-1)?.installArea,
    touch: seen.touch.at(-1)?.installArea,
  };
}

describe('SignageScreen の設置エリア', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it('実在の ID で設置エリアが決まり、3 部品に渡る', () => {
    const r = installAreaFor('12');
    expect(r.main).toMatchObject({ id: 12, name: '第一体育館' });
    expect(r.header).toBe(r.main);
    expect(r.touch).toBe(r.main);
  });

  it.each([null, 'abc', '999', '012'])('%s では設置エリア無し', (v) => {
    const r = installAreaFor(v);
    expect(r.main).toBeNull();
    expect(r.header).toBeNull();
    expect(r.touch).toBeNull();
  });
});
