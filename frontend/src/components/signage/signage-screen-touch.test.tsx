// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:3100',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
  },
}));
vi.mock('qrcode', () => ({
  default: { toString: vi.fn(async () => '<svg/>') },
}));

import type { SignageSlide, SignageSnapshot } from '@/lib/signage';
import type { SignageChannelState } from '@/lib/use-signage-channel';
import { SignageScreen } from './signage-screen';

let channel: SignageChannelState = {
  pin: undefined,
  snapshotVersion: undefined,
  latest: {},
};
vi.mock('@/lib/use-signage-channel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-signage-channel')>()),
  useSignageChannel: () => channel,
}));

let size = { width: 1920, height: 1080 };
const requestFullscreen = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.useFakeTimers();
  size = { width: 1920, height: 1080 };
  channel = { pin: undefined, snapshotVersion: undefined, latest: {} };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => size.width,
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => size.height,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 502 })),
  );
  document.documentElement.requestFullscreen = requestFullscreen;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });
});
afterEach(() => {
  requestFullscreen.mockClear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderScreen = () =>
  render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
const root = (c: HTMLElement) => c.firstElementChild as HTMLElement;
const hasNav = (c: HTMLElement) => c.textContent?.includes('駐車場空き情報');

describe('待機中の表示(5.2)', () => {
  it('タップしない限り操作層は無く、待機中の QR は現行の画像のまま', () => {
    const { container } = renderScreen();
    expect(hasNav(container)).toBeFalsy();
    const qr = container.querySelector<HTMLImageElement>(
      'img[src="/images/qr-aramakisai.svg"]',
    );
    expect(qr).not.toBeNull();
    expect(container.textContent).toContain('▼公式サイト');
    expect(container.textContent).not.toContain('この画面をスマホで見る');
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('操作層を開いても待機中の QR は変えない', () => {
    const { container } = renderScreen();
    const count = () =>
      container.querySelectorAll('img[src="/images/qr-aramakisai.svg"]').length;
    const before = count();
    fireEvent.pointerDown(root(container));
    expect(container.textContent).toContain('この画面をスマホで見る');
    expect(count()).toBe(before);
  });
});

describe('操作層の組み込み(5.1)', () => {
  it('タップで操作層が開き、全画面でなければ全画面化を呼ぶ', () => {
    const { container } = renderScreen();
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('全画面中は全画面化を呼ばない', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    });
    const { container } = renderScreen();
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBe(true);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('縦置きでは開かないが全画面化は行う', () => {
    size = { width: 500, height: 1330 };
    const { container } = renderScreen();
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBeFalsy();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('速報中のタップでは開かず、全画面化は行う。速報オーバーレイは操作層より後ろに置く', () => {
    channel = {
      pin: undefined,
      snapshotVersion: undefined,
      latest: {
        quake: {
          kind: 'broadcast',
          feature: 'quake',
          payload: {
            active: true,
            stage: 'warning',
            training: false,
            source: 'p2p',
            startedAt: '2026-11-14T00:00:00Z',
            updatedAt: '2026-11-14T00:00:00Z',
            observation: null,
          },
          expiresAt: null,
          sentAt: '2026-11-14T00:00:00Z',
        },
      } as unknown as SignageChannelState['latest'],
    };
    const { container } = renderScreen();
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBeFalsy();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('固定スライドがあるあいだはタップで開かず、解除後は開く', () => {
    const slide: SignageSlide = {
      id: 1,
      durationSec: 10,
      kind: 'layout',
      layout: 'title',
      tone: 'normal',
      title: 't',
      subtext: null,
      content1Html: '',
      content2Html: '',
    };
    const snapshot = {
      serverNow: '2026-11-14T00:00:00Z',
      pinnedSlideId: null,
      eventDays: [],
      slides: [slide],
      quakeSlides: {},
      telops: [],
      timetable: { days: [], stages: [], performances: [] },
      sponsors: [],
      lostItems: [],
      parking: { isEventDay: false, fetchedAt: '', lots: [] },
    } as unknown as SignageSnapshot;
    const ui = () => (
      <SignageScreen initial={snapshot} renderedAt={snapshot.serverNow} />
    );
    channel = { ...channel, pin: { slide, visibleSlideIds: [1] } };
    const { container, rerender } = render(ui());
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBeFalsy();

    channel = { ...channel, pin: { slide: null, visibleSlideIds: [1] } };
    rerender(ui());
    fireEvent.pointerDown(root(container));
    expect(hasNav(container)).toBe(true);

    channel = { ...channel, pin: { slide, visibleSlideIds: [1] } };
    rerender(ui());
    expect(container.querySelector('.fade-out')).not.toBeNull();
  });

  it('操作層は速報オーバーレイより前の兄弟として並ぶ', () => {
    const { container } = renderScreen();
    fireEvent.pointerDown(root(container));
    act(() => {});
    const canvas = container.querySelector('.signage-canvas')!;
    const kids = Array.from(canvas.children);
    const layer = kids.findIndex((k) =>
      k.textContent?.includes('駐車場空き情報'),
    );
    expect(layer).toBeGreaterThan(-1);
    expect(kids.findIndex((k) => k.hasAttribute('data-quake-overlay'))).toBe(
      -1,
    );
  });
});
