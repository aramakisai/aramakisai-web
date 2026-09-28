import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundShapes, PAGE_CONTAINER_ID } from './background-shapes';
import { MAIN_CONTENT_ID } from './header';
import type {
  PlacedShape,
  PlacementResult,
} from '@/lib/background-shapes/types';
import * as placementLib from '@/lib/background-shapes/placement';
import { entryDurationMs } from '@/lib/background-shapes-motion';

// 図形の入場・揺れ (要件 10) の実行時の振る舞いを検証する。配置の決定性・
// 除外領域は lib/background-shapes/placement.test.ts が別途担う
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const useMotionPreferenceMock = vi.fn(() => ({
  reduced: false,
  toggle: vi.fn(),
}));
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => useMotionPreferenceMock(),
}));

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(target: Element, isIntersecting = true) {
    this.callback(
      [{ target, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
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
      <footer />
      <BackgroundShapes />
    </div>
  );
}

/** ヘッダー・本文・フッターの計測値を固定し、装飾レイヤーの再計測を1度走らせる。 */
async function renderAndMeasure(shapes: PlacedShape[]) {
  vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
    placementResult(shapes),
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
    expect(document.querySelectorAll('[data-bg-shape]').length).toBe(
      shapes.length,
    );
  });

  return document.querySelectorAll<HTMLElement>('[data-bg-shape]');
}

function matchingIOs(el: Element): MockIntersectionObserver[] {
  return MockIntersectionObserver.instances.filter((instance) =>
    instance.observe.mock.calls.some(([target]) => target === el),
  );
}

/**
 * el を observe した IntersectionObserver のうち最後に登録されたものを返す。
 * ヘッダー高さの再計測 (resize) で shapes/entryOffsets の参照が変わり
 * useShapeMotion の effect が張り直されると、古い closure の IO も同じ DOM
 * 要素を observe した記録を残したまま残留する。先頭 (find) を拾うとその古い
 * closure を掴んでしまい、trigger しても現在動いている RAF ループの ready
 * フラグには反映されない。
 *
 * renderAndMeasure の waitFor は data-bg-shape 要素の出現 (コミット) しか
 * 待たず、その後に非同期でフラッシュされる useShapeMotion 側の passive
 * effect (IntersectionObserver の登録) までは待たない。両者の間に順序保証は
 * ないため、要素出現より effect のフラッシュが遅れる余地がある (CI の
 * 高負荷時にまれに顕在化する)。ここで登録自体を待ち直す。
 */
async function findActiveIO(el: Element): Promise<MockIntersectionObserver> {
  await waitFor(() => {
    expect(matchingIOs(el).length).toBeGreaterThan(0);
  });
  const matches = matchingIOs(el);
  return matches[matches.length - 1];
}

function firePointerMove(clientX: number, clientY: number) {
  const event = new Event('pointermove', { bubbles: true });
  Object.assign(event, { pointerType: 'mouse', clientX, clientY });
  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useMotionPreferenceMock.mockReturnValue({ reduced: false, toggle: vi.fn() });
  MockIntersectionObserver.instances = [];
  document.body.innerHTML = '';
});

// requestAnimationFrame は vitest の fakeTimers 既定では偽装対象に含まれず、
// advanceTimersByTime だけでは RAF ループが一切進まない。揺れの検証には
// 明示的に含める必要がある (Date は RAF タイムスタンプとポインター入力の
// 鮮度判定 (Date.now()) の時計を一致させるため併せて偽装する)
const RAF_FAKE_TIMERS = [
  'setTimeout',
  'clearTimeout',
  'Date',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
] as const;

/** 入場アニメーションを完了させ、揺れの計算対象 (ready) にする。 */
function completeEntry(io: MockIntersectionObserver, el: HTMLElement) {
  io.trigger(el, true);
  act(() => {
    vi.advanceTimersByTime(entryDurationMs('L'));
  });
}

describe('BackgroundShapes の動き', () => {
  it('入場アニメーションは図形につき 1 回だけ発火する', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];

    const io = await findActiveIO(el);

    vi.useFakeTimers();
    io.trigger(el, true);
    expect(io.unobserve).toHaveBeenCalledTimes(1);
    expect(el.style.transition).not.toBe('');

    act(() => {
      vi.advanceTimersByTime(entryDurationMs('L'));
    });
    // 入場完了後は transition がリセットされ、以後の揺れ (transform の直接書き換え) と
    // 衝突しない
    expect(el.style.transition).toBe('');

    // 現実の IntersectionObserver では unobserve 後にコールバックは届かないが、
    // 万一届いても再処理しないことを確認する (1 図形につき 1 回のガード)。
    // ガードが無いと 2 回目の trigger で transition が再設定され '' でなくなる
    io.trigger(el, true);
    expect(el.style.transition).toBe('');
  });

  it('モーション停止指定の間は入場アニメーションも揺れも行わない', async () => {
    useMotionPreferenceMock.mockReturnValue({ reduced: true, toggle: vi.fn() });
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];

    expect(MockIntersectionObserver.instances).toHaveLength(0);
    // 停止時は入場のずらしを持たず、最初から定位置 (回転のみ) で描画される
    expect(el.style.transform).toBe('rotate(0deg)');

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    firePointerMove(200, 300);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('画面内の図形はポインター操作で transform が変化する (対照)', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];

    const io = await findActiveIO(el);
    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    completeEntry(io, el);
    const restingTransform = el.style.transform;
    expect(restingTransform).toBe('rotate(0deg)');

    // ビューポート内 (jsdom既定 innerHeight=768) に図形があることにする
    stubRect(el, { x: 200, y: 300, width: 300, height: 300 });

    firePointerMove(200, 320);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 下の「画面外は変化しない」と対にして isOffscreenVertically の分岐そのものを
    // 検証する。この対照が無いと RAF ループが一度も回らない空振りを見逃す
    expect(el.style.transform).not.toBe(restingTransform);
  });

  it('画面外にある図形は揺れの計算を行わない', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];

    const io = await findActiveIO(el);
    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    completeEntry(io, el);
    const restingTransform = el.style.transform;
    expect(restingTransform).toBe('rotate(0deg)');

    // ビューポート (jsdom既定 innerHeight=768) の上端よりさらに上、余白 60px の
    // 外側に図形があることにする
    stubRect(el, { x: 200, y: -500, width: 300, height: 300 });

    firePointerMove(200, -480);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 反発力が働けば transform が変化するはずだが、画面外のため計算自体を
    // 省いており変化しない (要件 10.5 と対をなす揺れの性能配慮)
    expect(el.style.transform).toBe(restingTransform);
  });

  it('∞ は輪の入場が完了した後、外側要素にだけ揺れの transform が掛かる', async () => {
    const els = await renderAndMeasure([
      {
        tier: 'Inf',
        kind: 'ring',
        size: 140,
        cx: 200,
        cy: 300,
        rot: 0,
        texture: null,
        colors: ['ochre', 'olive'],
      },
    ]);
    const el = els[0];
    const rings = el.querySelectorAll<HTMLElement>('[data-bg-ring]');
    expect(rings).toHaveLength(2);

    const io = await findActiveIO(el);
    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    io.trigger(el, true);
    // 2 つ目の輪は 150ms 遅延するため、入場所要時間 (1400ms) + 150ms 経過させる
    act(() => {
      vi.advanceTimersByTime(entryDurationMs('Inf') + 150);
    });
    expect(rings[0].style.transition).toBe('');
    expect(rings[1].style.transition).toBe('');

    stubRect(el, { x: 200, y: 300, width: 260, height: 140 });
    firePointerMove(200, 320);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 外側要素は揺れで transform が変化するが、輪自身の transform (入場用) は
    // 揺れの対象ではない (design.md「揺れは外側要素に 1 つの transform で掛ける」)
    expect(el.style.transform).not.toBe('rotate(0deg)');
  });
});
