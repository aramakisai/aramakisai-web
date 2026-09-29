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
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1440, height: 200 });
    // jsdom の既定 innerWidth (1024) と異なる値にする。幅が変わらないリサイズは
    // 計算し直さない (要件 9.3 の裏返し) ため、初回計測との差を作る必要がある
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    // マウント時の初回計測はマイクロタスク 1 つ分遅れて走るため、この resize は
    // 実質 no-op (計測前で state が無い)。await でマイクロタスクを進めた時点では
    // 上のスタブが既に効いているので、初回計測自体がスタブ後の値を読む
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
    expect(call.width).toBe(1440);
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
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

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

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  private readonly cb: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    MockResizeObserver.instances.push(this);
  }

  trigger() {
    this.cb([], this as unknown as ResizeObserver);
  }
}

describe('計測・配置・保持・間引きの結合 (要件 9.1, 9.3)', () => {
  afterEach(() => {
    MockResizeObserver.instances = [];
  });

  it('同じ pathname・幅では DOM の高さが変わっても配置を計算し直さず、違反した図形だけを隠す', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const shapeA = shape({ tier: 'S', size: 80, cx: 100, cy: 300 });
    const shapeB = shape({ tier: 'S', size: 80, cx: 800, cy: 300 });
    const placeSpy = vi
      .spyOn(placementLib, 'placeBackgroundShapes')
      .mockReturnValue(placementResult([shapeA, shapeB]));

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1440, height: 200 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]')).toHaveLength(2);
    });
    expect(placeSpy).toHaveBeenCalledTimes(1);

    // 検索結果の件数変化などを模して、shapeB の位置を覆う不透明な面を本文へ足し、
    // 幅は変えないまま ResizeObserver (高さの変化) を発火する
    const mainEl = document.getElementById(MAIN_CONTENT_ID)!;
    const opaqueEl = document.createElement('div');
    opaqueEl.setAttribute('data-bg-opaque', 'true');
    mainEl.appendChild(opaqueEl);
    stubRect(opaqueEl, { x: 750, y: 250, width: 150, height: 150 });

    act(() => {
      MockResizeObserver.instances[0]?.trigger();
    });

    const shapeEls = () =>
      Array.from(document.querySelectorAll('[data-bg-shape]')) as HTMLElement[];

    await waitFor(() => {
      expect(
        shapeEls().filter((el) => el.style.visibility === 'hidden'),
      ).toHaveLength(1);
    });
    // 配置は計算し直さない (要件 9.1)。違反した図形 (shapeB) は DOM から消さず
    // visibility:hidden にするだけ (shapes 配列の参照を変えないため)
    expect(placeSpy).toHaveBeenCalledTimes(1);
    expect(shapeEls()).toHaveLength(2);
    const visible = shapeEls().find((el) => el.style.visibility !== 'hidden')!;
    expect(visible.style.left).toBe(`${shapeA.cx - shapeA.size / 2}px`);
  });

  it('幅が変わると配置を計算し直す (要件 9.3)', async () => {
    const placeSpy = vi
      .spyOn(placementLib, 'placeBackgroundShapes')
      .mockReturnValue(
        placementResult([shape({ tier: 'S', cx: 100, cy: 300 })]),
      );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => expect(placeSpy).toHaveBeenCalledTimes(1));

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => expect(placeSpy).toHaveBeenCalledTimes(2));
    expect(placeSpy.mock.calls.at(-1)?.[0].platform).toBe('sp');
  });

  it('間引き結果が変わらない ResizeObserver 発火では再描画しない (アコーディオン開閉時のちらつき防止)', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const shapeA = shape({ tier: 'S', size: 80, cx: 100, cy: 300 });
    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([shapeA]),
    );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1440, height: 200 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]')).toHaveLength(1);
    });

    // details-content の開閉アニメーション中に useShapeMotion が図形へ直接書き込む
    // transform を模す。間引き結果が変わらない再描画が起きればこの値は
    // outerStyle の rotate(0deg) だけの値に上書きされて消える
    const shapeEl = document.querySelector('[data-bg-shape]') as HTMLElement;
    shapeEl.style.transform = 'translate(42px, 7px) rotate(0deg)';

    // 高さだけが何度も変わる ResizeObserver の発火 (アコーディオンの 1 トランジション
    // 中に何十回も起こりうる) を模す。障害物・間引き対象は何も変えていない
    act(() => {
      MockResizeObserver.instances[0]?.trigger();
      MockResizeObserver.instances[0]?.trigger();
      MockResizeObserver.instances[0]?.trigger();
    });

    expect(shapeEl.style.transform).toBe('translate(42px, 7px) rotate(0deg)');
  });

  it('間引きで別の図形が隠れる/戻るときも、揺れの途中だった図形の transform は保持される (アコーディオン開閉時のちらつき防止)', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const shapeA = shape({ tier: 'S', size: 80, cx: 100, cy: 300 });
    const shapeB = shape({ tier: 'S', size: 80, cx: 800, cy: 300 });
    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([shapeA, shapeB]),
    );

    const { container } = render(<Harness />);
    const containerEl = document.getElementById(PAGE_CONTAINER_ID)!;
    const headerEl = container.querySelector('header')!;
    const footerEl = container.querySelector('footer')!;
    stubRect(containerEl, { x: 0, y: 0, width: 1440, height: 1200 });
    stubRect(headerEl, { x: 0, y: 0, width: 1440, height: 80 });
    stubRect(footerEl, { x: 0, y: 900, width: 1440, height: 200 });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]')).toHaveLength(2);
    });

    const [elA, elB] = Array.from(
      document.querySelectorAll('[data-bg-shape]'),
    ) as HTMLElement[];
    // details-content の開閉アニメーション中に useShapeMotion が shapeA へ直接
    // 書き込む transform (揺れの途中位置) を模す。shapes (base) 配列の参照が
    // 保たれていれば、shapeB だけが隠れる/戻る更新が起きてもこの値は無事
    elA.style.transform = 'translate(42px, 7px) rotate(0deg)';

    // FAQ の回答を開いたときのように、shapeB の位置だけを覆う不透明な面が現れる
    const mainEl = document.getElementById(MAIN_CONTENT_ID)!;
    const opaqueEl = document.createElement('div');
    opaqueEl.setAttribute('data-bg-opaque', 'true');
    mainEl.appendChild(opaqueEl);
    stubRect(opaqueEl, { x: 750, y: 250, width: 150, height: 150 });

    act(() => {
      MockResizeObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(elB.style.visibility).toBe('hidden');
    });
    expect(elA.style.visibility).not.toBe('hidden');
    expect(elA.style.transform).toBe('translate(42px, 7px) rotate(0deg)');

    // 回答を閉じて shapeB の位置が空くケース (要素は再利用され、隠れていたものが戻る)
    mainEl.removeChild(opaqueEl);
    act(() => {
      MockResizeObserver.instances[0]?.trigger();
    });
    await waitFor(() => {
      expect(elB.style.visibility).not.toBe('hidden');
    });
    expect(elA.style.transform).toBe('translate(42px, 7px) rotate(0deg)');
  });
});
