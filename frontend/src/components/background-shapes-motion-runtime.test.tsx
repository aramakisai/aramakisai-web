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

// 配置は clientWidth (スクロールバーを除く)、PC/SP 判定は innerWidth を読む
function setViewportWidth(width: number) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    width,
  );
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
    texture: 'watercolor',
    texturePos: [50, 50],
    textureRot: 30,
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

let rerenderHarness: () => void = () => {};

/** ヘッダー・本文・フッターの計測値を固定し、装飾レイヤーの再計測を1度走らせる。 */
async function renderAndMeasure(shapes: PlacedShape[]) {
  vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
    placementResult(shapes),
  );

  const { container, rerender } = render(<Harness />);
  rerenderHarness = () => rerender(<Harness />);
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
  setViewportWidth(1440);

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

interface MockAnimation {
  target: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
  onfinish: (() => void) | null;
}
let animations: MockAnimation[] = [];

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  animations = [];
  // jsdom は Web Animations API を持たない
  HTMLElement.prototype.animate = function (
    this: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const anim: MockAnimation = {
      target: this,
      keyframes,
      options,
      cancel: vi.fn(),
      onfinish: null,
    };
    animations.push(anim);
    return anim as unknown as Animation;
  } as unknown as HTMLElement['animate'];
});

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
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
  act(() => animations.forEach((a) => a.onfinish?.()));
}

describe('BackgroundShapes の動き', () => {
  it('入場は内側要素の Web Animations で、図形につき 1 回だけ発火する', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];
    const inner = el.firstElementChild as HTMLElement;

    const io = await findActiveIO(el);
    // 交差判定は定位置の外側要素で行う (入場の起点が画面外でも判定が変わらない)
    expect(matchingIOs(inner)).toHaveLength(0);
    // 入場前の図形は不透明度 0
    expect(inner.style.opacity).toBe('0');

    io.trigger(el, true);
    expect(io.unobserve).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(1);
    const [anim] = animations;
    expect(anim.target).toBe(inner);
    expect(anim.options.duration).toBe(entryDurationMs('L'));
    expect(anim.options.easing).toBe('cubic-bezier(0.16, 0.84, 0.44, 1)');
    expect(anim.keyframes[0].opacity).toBe(0);
    expect(anim.keyframes[1].opacity).toBe(1);
    // 命令的な transition・transform を外側要素に書き込まない
    expect(el.style.transition).toBe('');
    expect(el.style.transform).toBe('rotate(0deg)');

    act(() => anim.onfinish?.());
    expect(inner.style.opacity).toBe('');

    // 万一 2 回目が届いても再処理しない
    io.trigger(el, true);
    expect(animations).toHaveLength(1);
  });

  it('入場中にモーション停止にすると Animation を取り消し、不透明度 1 の定位置になる', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];
    const inner = el.firstElementChild as HTMLElement;
    const io = await findActiveIO(el);
    io.trigger(el, true);

    useMotionPreferenceMock.mockReturnValue({ reduced: true, toggle: vi.fn() });
    act(() => rerenderHarness());

    expect(animations[0].cancel).toHaveBeenCalled();
    expect(inner.style.opacity).toBe('');
    expect(el.style.transform).toBe('rotate(0deg)');
  });

  it('入場済みの図形は停止→再生で入場し直さない', async () => {
    const els = await renderAndMeasure([shape({ cy: 300 })]);
    const el = els[0];
    const inner = el.firstElementChild as HTMLElement;
    const io = await findActiveIO(el);
    io.trigger(el, true);
    act(() => animations[0].onfinish?.());

    useMotionPreferenceMock.mockReturnValue({ reduced: true, toggle: vi.fn() });
    act(() => rerenderHarness());
    useMotionPreferenceMock.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
    act(() => rerenderHarness());

    expect(inner.style.opacity).toBe('');
    expect(animations).toHaveLength(1);
    // 再生後に交差通知が来ても入場しない
    const io2 = await findActiveIO(el);
    io2.trigger(el, true);
    expect(animations).toHaveLength(1);
  });

  it('入場中に図形が追加されても入場中の Animation は取り消されず、完了で入場済みになる', async () => {
    const s1 = shape({ cy: 300 });
    const els = await renderAndMeasure([s1]);
    const el = els[0];
    const io = await findActiveIO(el);
    io.trigger(el, true);
    expect(animations).toHaveLength(1);

    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([s1, shape({ cy: 900 })]),
    );
    setViewportWidth(1441);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[data-bg-shape]').length).toBe(2);
    });

    expect(animations[0].cancel).not.toHaveBeenCalled();
    expect(animations).toHaveLength(1);

    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    act(() => animations[0].onfinish?.());
    stubRect(el, { x: 200, y: 300, width: 300, height: 300 });
    firePointerMove(200, 320);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // 張り直し後の effect でも揺れの対象 (入場済み) になっている
    expect(el.style.transform).not.toBe('rotate(0deg)');
    expect(animations).toHaveLength(1);
  });

  it('図形の追加で effect が張り直されても揺れの状態は 0 に戻らない', async () => {
    const s1 = shape({ cy: 300 });
    const els = await renderAndMeasure([s1]);
    const el = els[0];
    const io = await findActiveIO(el);
    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    completeEntry(io, el);
    stubRect(el, { x: 200, y: 300, width: 300, height: 300 });
    firePointerMove(200, 320);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const dispOf = () =>
      Math.hypot(
        ...(
          el.style.transform.match(
            /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/,
          ) ?? ['', '0', '0']
        )
          .slice(1)
          .map(Number),
      );
    const before = dispOf();
    expect(before).toBeGreaterThan(0.1);

    vi.spyOn(placementLib, 'placeBackgroundShapes').mockReturnValue(
      placementResult([s1, shape({ cy: 900 })]),
    );
    setViewportWidth(1441);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(document.querySelectorAll('[data-bg-shape]').length).toBe(2);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(16);
    });
    expect(dispOf()).toBeGreaterThan(before * 0.5);
  });

  it('交差判定は定位置の外側要素で行い、入場の起点がレイヤー外でも定位置が交差すれば入場が始まる', async () => {
    const els = await renderAndMeasure([shape({ cx: 40, cy: 300 })]);
    const el = els[0];
    const inner = el.firstElementChild as HTMLElement;
    const io = await findActiveIO(el);
    expect(matchingIOs(inner)).toHaveLength(0);
    expect(animations).toHaveLength(0);

    io.trigger(el, true);
    expect(animations).toHaveLength(1);
    expect(animations[0].target).toBe(inner);
    expect(animations[0].keyframes[0].transform).not.toBe(
      animations[0].keyframes[1].transform,
    );
  });

  it('∞ は 2 つの輪がそれぞれ入場し、2 つ目だけ 150ms 遅れる', async () => {
    const els = await renderAndMeasure([
      {
        tier: 'Inf',
        kind: 'ring',
        size: 140,
        cx: 200,
        cy: 300,
        rot: 0,
        texture: null,
        texturePos: null,
        textureRot: null,
        colors: ['ochre', 'olive'],
      },
    ]);
    const el = els[0];
    const rings = el.querySelectorAll<HTMLElement>('[data-bg-ring]');
    expect(rings[0].style.opacity).toBe('0');
    const io = await findActiveIO(el);
    io.trigger(el, true);

    expect(animations.map((a) => a.target)).toEqual([rings[0], rings[1]]);
    expect(animations.map((a) => a.options.delay)).toEqual([0, 150]);
    expect(animations.map((a) => a.options.duration)).toEqual([1400, 1400]);
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
        texturePos: null,
        textureRot: null,
        colors: ['ochre', 'olive'],
      },
    ]);
    const el = els[0];
    const rings = el.querySelectorAll<HTMLElement>('[data-bg-ring]');
    expect(rings).toHaveLength(2);

    const io = await findActiveIO(el);
    vi.useFakeTimers({ toFake: [...RAF_FAKE_TIMERS] });
    io.trigger(el, true);
    act(() => animations.forEach((a) => a.onfinish?.()));

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
