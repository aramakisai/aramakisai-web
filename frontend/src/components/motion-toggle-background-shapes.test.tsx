import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundShapes, PAGE_CONTAINER_ID } from './background-shapes';
import { MotionToggle } from './motion-toggle';
import { MAIN_CONTENT_ID } from './header';
import type {
  PlacedShape,
  PlacementResult,
} from '@/lib/background-shapes/types';
import * as placementLib from '@/lib/background-shapes/placement';

// use-motion-preference は mock せず実フックで結線を確認する
// (個々の停止時挙動は background-shapes-motion-runtime.test.tsx 側が担う)
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

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
    cx: 200,
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
      <main id={MAIN_CONTENT_ID}>
        <section />
      </main>
      <footer>
        <MotionToggle />
      </footer>
      <BackgroundShapes />
    </div>
  );
}

beforeEach(() => {
  stubMatchMedia(false);
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-motion');
  document.body.innerHTML = '';
});

describe('MotionToggle と BackgroundShapes の結線', () => {
  it('フッターの MotionToggle で停止に切り替えると、本文の揺れの入力受付も止まる', async () => {
    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([shape({ cy: 300 })]),
    );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const sectionEl = container.querySelector('section')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    stubRect(sectionEl, { x: 0, y: 80, width: 1440, height: 1000 });
    stubRect(footerEl, { x: 0, y: 1080, width: 1440, height: 120 });
    // jsdom の既定 innerWidth (1024) と異なる値にする。幅が変わらないリサイズは
    // 計算し直さない (要件 9.3 の裏返し) ため、初回計測との差を作る必要がある
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]').length).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'モーション' }));
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-motion')).toBe(
        'reduce',
      );
    });

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const pointerMove = new Event('pointermove', { bubbles: true });
    Object.assign(pointerMove, {
      pointerType: 'mouse',
      clientX: 200,
      clientY: 300,
    });
    act(() => {
      window.dispatchEvent(pointerMove);
    });

    // 停止指定が BackgroundShapes 側の reduced にも伝わっていれば、
    // ポインター移動の入力を受けても揺れの描画ループ (RAF) は始まらない
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
