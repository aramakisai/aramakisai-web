import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/signage-data', () => ({ getSignageSnapshot: vi.fn() }));

const screenProps: Record<string, unknown>[] = [];
vi.mock('@/components/signage/signage-screen', () => ({
  SignageScreen: (props: Record<string, unknown>) => {
    screenProps.push(props);
    return <div data-testid="signage-screen" />;
  },
}));

import { getSignageSnapshot } from '@/lib/signage-data';
import { isPublicPath } from '@/lib/phase';
import SignagePage, { metadata, viewport } from './page';

const mocked = vi.mocked(getSignageSnapshot);
const props = (map_area?: string | string[]) => ({
  searchParams: Promise.resolve({ map_area }),
});

describe('/signage', () => {
  beforeEach(() => {
    mocked.mockReset();
    screenProps.length = 0;
  });

  it('開催前でも公開対象である', () => {
    expect(isPublicPath('/signage', 'pre_event')).toBe(true);
  });

  it('検索エンジンに載せない指定を出力する', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('viewport で拡大を禁止する', () => {
    expect(viewport).toEqual({ maximumScale: 1, userScalable: false });
  });

  it('取得したスナップショットを画面部品へ渡す', async () => {
    const value = { fetchedAt: 'x' } as never;
    mocked.mockResolvedValue({ ok: true, value });
    render(await SignagePage(props()));
    expect(screen.getByTestId('signage-screen')).toBeTruthy();
    expect(screenProps[0].initial).toBe(value);
    expect(typeof screenProps[0].renderedAt).toBe('string');
  });

  it('Noto Sans JP の読み込みを出力しない', async () => {
    mocked.mockResolvedValue({ ok: true, value: { fetchedAt: 'x' } as never });
    const { container } = render(await SignagePage(props()));
    expect(container.innerHTML).not.toMatch(/noto/i);
    expect(container.querySelector('link[rel="preload"]')).toBeNull();
    expect(container.innerHTML).not.toContain('@font-face');
  });

  it('取得に失敗しても開け、初期値は null', async () => {
    mocked.mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    render(await SignagePage(props()));
    expect(screenProps[0].initial).toBeNull();
  });

  it.each([
    ['12', '12'],
    ['abc', 'abc'],
    [undefined, null],
    [['1', '2'], null],
  ])('map_area=%j は mapArea=%j として渡す', async (value, expected) => {
    mocked.mockResolvedValue({ ok: true, value: { fetchedAt: 'x' } as never });
    render(await SignagePage(props(value)));
    expect(screenProps[0].mapArea).toBe(expected);
  });
});
