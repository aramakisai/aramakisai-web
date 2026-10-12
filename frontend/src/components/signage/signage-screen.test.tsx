// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

import type { SignageSnapshot } from '@/lib/signage';
import type { SignageChannelState } from '@/lib/use-signage-channel';
import { SignageScreen } from './signage-screen';

const CHANNEL_IDLE: SignageChannelState = {
  pin: undefined,
  snapshotVersion: undefined,
  latest: {},
};
let channel: SignageChannelState = CHANNEL_IDLE;
const correctedNow = vi.hoisted(() => vi.fn());
vi.mock('@/lib/signage-time', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/signage-time')>();
  return {
    ...actual,
    useCorrectedNow: (...args: Parameters<typeof actual.useCorrectedNow>) => {
      correctedNow(...args);
      return actual.useCorrectedNow(...args);
    },
  };
});
vi.mock('@/lib/use-signage-channel', () => ({
  useSignageChannel: () => channel,
}));

let viewport = { width: 500, height: 1330 };

describe('SignageScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    viewport = { width: 500, height: 1330 };
    channel = CHANNEL_IDLE;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
      () => viewport.width,
    );
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
      () => viewport.height,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('初回取得に失敗しても描画でき、縦型では縦型キャンバスを使う', async () => {
    const { container } = render(
      <SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />,
    );
    const canvas = container.querySelector<HTMLElement>('.signage-canvas')!;
    expect(canvas.style.width).toBe('1080px');
    expect(canvas.style.height).toBe('1920px');
  });

  it('縦長の細いペインでも縦型キャンバスを全体が収まる倍率で中央に置く', () => {
    const { container } = render(
      <SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />,
    );
    const canvas = container.querySelector<HTMLElement>('.signage-canvas')!;
    expect(canvas.dataset.orientation).toBe('portrait');
    expect(canvas.style.transform).toBe(`scale(${500 / 1080})`);
    expect(canvas.style.left).toBe('0px');
    expect(parseFloat(canvas.style.top)).toBeCloseTo(
      (1330 - 1920 * (500 / 1080)) / 2,
    );
  });

  it('横長なら横型キャンバスを使う', () => {
    viewport = { width: 1600, height: 300 };
    const { container } = render(
      <SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />,
    );
    const canvas = container.querySelector<HTMLElement>('.signage-canvas')!;
    expect(canvas.dataset.orientation).toBe('landscape');
    expect(canvas.style.width).toBe('1920px');
    expect(canvas.style.transform).toBe(`scale(${300 / 1080})`);
  });

  it('初回取得に失敗している間は「いまのステージ」見出しを出さない', () => {
    const { container } = render(
      <SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />,
    );
    expect(container.textContent).not.toContain('いまのステージ');
  });

  it('2分ごとに集約APIを読み、失敗しても画面は落ちない', async () => {
    render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(fetch).toHaveBeenCalledWith('/api/signage', { cache: 'no-store' });
  });

  it('初期スナップショットがあってもマウント直後に1回取得し、往復時間込みの時計に更新する', async () => {
    const initial: SignageSnapshot = {
      fetchedAt: '',
      serverNow: '2026-11-14T00:00:00Z',
      pinnedSlideId: null,
      eventDays: [],
      slides: [],
      telops: [],
      timetable: { days: [], stages: [], performances: [] },
      sponsors: [],
      lostItems: [],
      parking: { isEventDay: false, fetchedAt: '', lots: [] },
    };
    render(<SignageScreen initial={initial} renderedAt={initial.serverNow} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    const urls = vi.mocked(fetch).mock.calls.map(([u]) => u);
    expect(urls.filter((u) => u === '/api/signage')).toHaveLength(1);
  });

  describe('時計のずれ', () => {
    const snap = (serverNow: string): SignageSnapshot => ({
      fetchedAt: '',
      serverNow,
      pinnedSlideId: null,
      eventDays: [],
      slides: [],
      telops: [],
      timetable: { days: [], stages: [], performances: [] },
      sponsors: [],
      lostItems: [],
      parking: { isEventDay: false, fetchedAt: '', lots: [] },
    });
    const lastOffset = () => correctedNow.mock.calls.at(-1)?.[0];

    it('初回の取得前は表示開始時のずれを使う', async () => {
      vi.setSystemTime(Date.parse('2026-11-14T00:00:00Z'));
      render(
        <SignageScreen initial={null} renderedAt="2026-11-14T00:00:03Z" />,
      );
      expect(lastOffset()).toBe(3000);
    });

    it('取得したスナップショットの serverNow でずれを更新し、取得に失敗しても直前のずれを保つ', async () => {
      vi.setSystemTime(Date.parse('2026-11-14T00:00:00Z'));
      vi.mocked(fetch).mockImplementationOnce(
        async () =>
          new Response(JSON.stringify(snap('2026-11-14T00:00:07Z')), {
            status: 200,
          }),
      );
      render(
        <SignageScreen initial={null} renderedAt="2026-11-14T00:00:03Z" />,
      );
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(lastOffset()).toBe(7000);
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(lastOffset()).toBe(7000);
    });

    it('版付きの取り直しのスナップショットでもずれを更新する', async () => {
      vi.setSystemTime(Date.parse('2026-11-14T00:00:00Z'));
      vi.mocked(fetch).mockImplementation(async (url) => {
        const skew = String(url).includes('?v=') ? 9000 : 1000;
        return new Response(
          JSON.stringify(snap(new Date(Date.now() + skew).toISOString())),
          { status: 200 },
        );
      });
      channel = { ...CHANNEL_IDLE, snapshotVersion: 100 };
      render(
        <SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />,
      );
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(lastOffset()).toBe(1000);
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(lastOffset()).toBe(9000);
    });
  });

  it('固定状態を3秒ごとに確認しない(配信経路で受ける)', async () => {
    render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    const pins = vi
      .mocked(fetch)
      .mock.calls.filter(([u]) => u === '/api/signage/pin');
    expect(pins).toHaveLength(0);
  });

  describe('スナップショットの版', () => {
    const snapshot: SignageSnapshot = {
      fetchedAt: '',
      serverNow: '2026-11-14T00:00:00Z',
      pinnedSlideId: null,
      eventDays: [],
      slides: [],
      telops: [],
      timetable: { days: [], stages: [], performances: [] },
      sponsors: [],
      lostItems: [],
      parking: { isEventDay: false, fetchedAt: '', lots: [] },
    };
    const versioned = () =>
      vi
        .mocked(fetch)
        .mock.calls.map(([u]) => u)
        .filter((u) => String(u).startsWith('/api/signage?v='));

    beforeEach(() => {
      vi.mocked(fetch).mockImplementation(
        async () => new Response(JSON.stringify(snapshot), { status: 200 }),
      );
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    const renderScreen = () =>
      render(
        <SignageScreen initial={snapshot} renderedAt={snapshot.serverNow} />,
      );

    it('初回の版は乱数の待ちの後に取り直す', async () => {
      channel = { ...CHANNEL_IDLE, snapshotVersion: 100 };
      renderScreen();
      await act(() => vi.advanceTimersByTimeAsync(499));
      expect(versioned()).toHaveLength(0);
      await act(() => vi.advanceTimersByTimeAsync(2));
      expect(versioned()).toEqual(['/api/signage?v=100']);
    });

    it('同じ版では取り直さず、版が変われば取り直す', async () => {
      channel = { ...CHANNEL_IDLE, snapshotVersion: 100 };
      const { rerender } = renderScreen();
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      channel = { ...CHANNEL_IDLE, snapshotVersion: 100 };
      rerender(
        <SignageScreen initial={snapshot} renderedAt={snapshot.serverNow} />,
      );
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(versioned()).toHaveLength(1);
      channel = { ...CHANNEL_IDLE, snapshotVersion: 200 };
      rerender(
        <SignageScreen initial={snapshot} renderedAt={snapshot.serverNow} />,
      );
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(versioned()).toEqual(['/api/signage?v=100', '/api/signage?v=200']);
    });

    it('版を受けた後の2分ポーリングも版付きで取る', async () => {
      channel = { ...CHANNEL_IDLE, snapshotVersion: 100 };
      renderScreen();
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      vi.mocked(fetch).mockClear();
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      expect(vi.mocked(fetch).mock.calls.map(([u]) => u)).toEqual([
        '/api/signage?v=100',
      ]);
    });

    it('版が無い間は取り直さない', async () => {
      renderScreen();
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(versioned()).toHaveLength(0);
    });
  });
});
