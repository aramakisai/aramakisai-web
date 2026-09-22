import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BackgroundShapes,
  PAGE_CONTAINER_ID,
  splitShapesByHeaderHeight,
} from './background-shapes';
import { HEADER_BG_SHAPES_SLOT_ID, MAIN_CONTENT_ID } from './header';
import type { PlacedShape } from '@/lib/background-shapes';
import * as backgroundShapesLib from '@/lib/background-shapes';

vi.mock('next/navigation', () => ({
  usePathname: () => '/topics',
}));

// 実際の localStorage/matchMedia は use-motion-preference.test.ts が担う。
// ここでは動きが `reduced` の値に従うことだけをテストするため差し替える
// (afterEach の vi.restoreAllMocks に巻き込まれないよう vi.mock で固定する)
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

function shape(overrides: Partial<PlacedShape>): PlacedShape {
  return {
    kind: 'circle',
    size: 40,
    x: 10,
    y: 10,
    rotation: 0,
    color: 'bansai-ochre',
    texture: 'none',
    ...overrides,
  };
}

function Harness() {
  return (
    <div id={PAGE_CONTAINER_ID}>
      <header>
        <div id={HEADER_BG_SHAPES_SLOT_ID} />
      </header>
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

describe('splitShapesByHeaderHeight', () => {
  it('y がヘッダー高さ未満の図形をヘッダー側、以上を本文側に振り分ける', () => {
    const shapes = [
      shape({ y: 10 }),
      shape({ y: 79.9 }),
      shape({ y: 80 }),
      shape({ y: 500 }),
    ];

    const { headerShapes, bodyShapes } = splitShapesByHeaderHeight(shapes, 80);

    expect(headerShapes).toHaveLength(2);
    expect(bodyShapes).toHaveLength(2);
  });

  it('リングの組は primary の y で一括して振り分ける (secondary だけが閾値を跨いでも分断しない)', () => {
    const primary = shape({
      kind: 'ring',
      ringVariant: 'primary',
      y: 70,
      size: 64,
    });
    // secondary は primary から size×0.34 = 21.76 ずれるため、primary が
    // ヘッダー側でも secondary 単体の y (91.76) はヘッダー高さ 80 を超える
    const secondary = shape({
      kind: 'ring',
      ringVariant: 'secondary',
      y: 91.76,
      size: 43.52,
    });

    const { headerShapes, bodyShapes } = splitShapesByHeaderHeight(
      [primary, secondary],
      80,
    );

    expect(headerShapes).toEqual([primary, secondary]);
    expect(bodyShapes).toHaveLength(0);
  });
});

describe('BackgroundShapes', () => {
  it('SSR (エフェクト未実行) では図形を描画しない', () => {
    const markup = renderToStaticMarkup(<Harness />);
    expect(markup).not.toContain('data-bg-shape');
  });

  it('計測後にヘッダー内の図形を slot へ portal し、本文の図形を別レイヤーへ描画する', async () => {
    const computeSpy = vi
      .spyOn(backgroundShapesLib, 'computeBackgroundShapePlacement')
      .mockReturnValue([
        shape({ kind: 'circle', y: 20 }), // ヘッダー領域 (< headerHeight)
        shape({ kind: 'square', y: 300 }), // 本文領域
      ]);

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1024, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1024, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1024, height: 200 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);

    // マウント直後の計測はスタブ前 (高さ 0) に走るため、リサイズを発火して
    // スタブ後の値で再計測させる (design.md 「レイアウトが変わったとき再計測する」)
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(computeSpy.mock.calls.at(-1)?.[0].pageHeight).toBe(1200);
    });

    const slot = document.getElementById(HEADER_BG_SHAPES_SLOT_ID)!;
    expect(slot.querySelectorAll('[data-bg-shape]')).toHaveLength(1);
    expect(slot.querySelector('[data-shape-kind="circle"]')).toBeTruthy();

    const bodyLayer = document.querySelector(
      '[data-bg-shapes-body]',
    ) as HTMLElement;
    expect(bodyLayer).toBeTruthy();
    expect(bodyLayer.getAttribute('aria-hidden')).toBe('true');
    expect(bodyLayer.querySelectorAll('[data-bg-shape]')).toHaveLength(1);
    expect(bodyLayer.querySelector('[data-shape-kind="square"]')).toBeTruthy();
    // レイヤー自身は absolute inset-0 でコンテナに追従させ、固定 px は持たせない
    // (レイヤーの高さがコンテナの計測に混ざるとページが縮んでも追従しなくなる)
    expect(bodyLayer.style.height).toBe('');

    const call = computeSpy.mock.calls.at(-1)![0];
    expect(call.pathname).toBe('/topics');
    expect(call.pageHeight).toBe(1200);
    expect(call.viewportWidth).toBe(1024);
    expect(call.excludeRects).toContainEqual({
      x: 0,
      y: 900,
      width: 1024,
      height: 200,
    });
  });

  it('ページが縮むリサイズでは pageHeight も縮む (装飾レイヤーの高さを引きずらない)', async () => {
    const computeSpy = vi
      .spyOn(backgroundShapesLib, 'computeBackgroundShapePlacement')
      .mockReturnValue([shape({ kind: 'circle', y: 300 })]);

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    stubRect(headerEl, { x: 0, y: 0, width: 375, height: 80 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);

    // SP 幅で高さ 5000px のページとして 1 回目の計測をする
    stubRect(containerEl, { x: 0, y: 0, width: 375, height: 5000 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(computeSpy.mock.calls.at(-1)?.[0].pageHeight).toBe(5000);
    });

    // PC 幅へリサイズし、内容も 3000px に縮んだとする。装飾レイヤーが absolute
    // inset-0 でコンテナに追従していれば、コンテナの計測値自体が縮む
    stubRect(containerEl, { x: 0, y: 0, width: 1024, height: 3000 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(computeSpy.mock.calls.at(-1)?.[0].pageHeight).toBe(3000);
    });
  });
});
