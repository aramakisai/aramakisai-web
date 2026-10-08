// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

import { SignageScreen } from './signage-screen';

describe('SignageScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it('20秒ごとに集約APIを読み、失敗しても画面は落ちない', async () => {
    render(<SignageScreen initial={null} renderedAt="2026-11-14T00:00:00Z" />);
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(fetch).toHaveBeenCalledWith('/api/signage', { cache: 'no-store' });
  });
});
