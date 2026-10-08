// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

import type { SignageSnapshot } from '@/lib/signage';
import { SignageScreen } from './signage-screen';

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

  it('20秒ごとに集約APIを読み、失敗しても画面は落ちない', async () => {
    render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
    await act(() => vi.advanceTimersByTimeAsync(20_000));
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

  it('固定状態を3秒ごとに確認する', async () => {
    render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
    await act(() => vi.advanceTimersByTimeAsync(6_000));
    const pins = vi
      .mocked(fetch)
      .mock.calls.filter(([u]) => u === '/api/signage/pin');
    expect(pins.length).toBeGreaterThanOrEqual(3);
  });
});
