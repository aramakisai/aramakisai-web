import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackgroundShapes, PAGE_CONTAINER_ID } from './background-shapes';
import { MAIN_CONTENT_ID } from './header';
import type {
  PlacedShape,
  PlacementResult,
} from '@/lib/background-shapes/types';
import * as placementLib from '@/lib/background-shapes/placement';

vi.mock('next/navigation', () => ({
  usePathname: () => '/topics',
}));

// 実際の localStorage/matchMedia は use-motion-preference.test.ts が担う。
// ここでは動きが `reduced` の値に従うことだけをテストするため差し替える
const useMotionPreferenceMock = vi.fn(() => ({
  reduced: false,
  toggle: vi.fn(),
}));
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => useMotionPreferenceMock(),
}));

function stubRect(
  el: Element,
  rect: { x: number; y: number; width: number; height: number },
) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON() {
      return this;
    },
  });
}

function shape(overrides: Partial<PlacedShape> = {}): PlacedShape {
  return {
    tier: 'L',
    kind: 'circle',
    size: 300,
    cx: 100,
    cy: 300,
    rot: 0,
    texture: 'L1',
    colors: null,
    ...overrides,
  } as PlacedShape;
}

function placementResult(shapes: readonly PlacedShape[]): PlacementResult {
  return {
    shapes,
    target: { Inf: 0, L: 0, S: 0 },
    deficit: { Inf: 0, L: 0, S: 0 },
  };
}

function Harness() {
  return (
    <div id={PAGE_CONTAINER_ID}>
      <header />
      <main id={MAIN_CONTENT_ID} />
      <footer />
      <BackgroundShapes />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  useMotionPreferenceMock.mockReturnValue({ reduced: false, toggle: vi.fn() });
  document.body.innerHTML = '';
});

describe('BackgroundShapes', () => {
  it('SSR (エフェクト未実行) では図形を描画しない', () => {
    const markup = renderToStaticMarkup(<Harness />);
    expect(markup).not.toContain('data-bg-shape');
  });

  it('計測後に配置結果の図形を単一の本文レイヤーへ描画する (ヘッダーには描かない)', async () => {
    const placeSpy = vi
      .spyOn(placementLib, 'placeBackgroundShapes')
      .mockReturnValue(
        placementResult([
          shape({ kind: 'circle', tier: 'L', cy: 20 }),
          shape({
            kind: 'square',
            tier: 'S',
            size: 90,
            texture: 'S1',
            cy: 300,
          }),
        ]),
      );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1024, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1024, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1024, height: 200 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);

    // マウント直後の計測はスタブ前 (高さ 0) に走るため、リサイズを発火して
    // スタブ後の値で再計測させる
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(placeSpy.mock.calls.at(-1)?.[0].height).toBe(1200);
    });

    const bodyLayer = document.querySelector(
      '[data-bg-shapes-body]',
    ) as HTMLElement;
    expect(bodyLayer).toBeTruthy();
    expect(bodyLayer.getAttribute('aria-hidden')).toBe('true');
    expect(bodyLayer.querySelectorAll('[data-bg-shape]')).toHaveLength(2);
    expect(bodyLayer.querySelector('[data-shape-kind="circle"]')).toBeTruthy();
    expect(bodyLayer.querySelector('[data-shape-kind="square"]')).toBeTruthy();
    // ヘッダーには一切描かない (ヘッダー内の portal スロットは削除済み)
    expect(headerEl.querySelector('[data-bg-shape]')).toBeNull();
    // レイヤー自身は absolute inset-0 でコンテナに追従させ、固定 px は持たせない
    expect(bodyLayer.style.height).toBe('');

    const call = placeSpy.mock.calls.at(-1)![0];
    expect(call.pathname).toBe('/topics');
    expect(call.platform).toBe('pc');
    expect(call.height).toBe(1200);
    expect(call.width).toBe(1024);
    expect(call.decorTop).toBe(80);
    expect(call.decorBottom).toBe(900);
  });

  it('SP 幅 (1024px 未満) では platform を sp で呼ぶ', async () => {
    const placeSpy = vi
      .spyOn(placementLib, 'placeBackgroundShapes')
      .mockReturnValue(placementResult([]));

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    stubRect(containerEl, { x: 0, y: 0, width: 375, height: 2000 });
    stubRect(headerEl, { x: 0, y: 0, width: 375, height: 64 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(placeSpy.mock.calls.at(-1)?.[0].platform).toBe('sp');
    });
  });

  it('ページが縮むリサイズでは height も縮む (装飾レイヤーの高さを引きずらない)', async () => {
    const placeSpy = vi
      .spyOn(placementLib, 'placeBackgroundShapes')
      .mockReturnValue(placementResult([shape({ cy: 300 })]));

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    stubRect(headerEl, { x: 0, y: 0, width: 375, height: 64 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);

    stubRect(containerEl, { x: 0, y: 0, width: 375, height: 5000 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(placeSpy.mock.calls.at(-1)?.[0].height).toBe(5000);
    });

    stubRect(containerEl, { x: 0, y: 0, width: 1024, height: 3000 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(placeSpy.mock.calls.at(-1)?.[0].height).toBe(3000);
    });
  });

  it('∞ は 2 つの輪 (data-bg-ring) を持つ 1 つの図形として描画する', async () => {
    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([
        {
          tier: 'Inf',
          kind: 'ring',
          size: 140,
          cx: 200,
          cy: 300,
          rot: 5,
          texture: null,
          colors: ['ochre', 'olive'],
        },
      ]),
    );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1024, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1024, height: 80 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]')).toHaveLength(1);
    });

    const infEl = document.querySelector('[data-bg-tier="Inf"]')!;
    expect(infEl.querySelectorAll('[data-bg-ring]')).toHaveLength(2);
  });
});
