import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapBottomSheet } from './map-bottom-sheet';
import type { AreaExhibitionListState } from './area-exhibition-list';

// jsdom は PointerEvent を生成できない (document.createEvent('PointerEvent') が
// 例外を投げる) ため、必要なプロパティを持つ汎用 Event を代わりに送出する
function firePointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  props: { clientY: number; clientX?: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 0, ...props });
  fireEvent(element, event);
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  trigger(target: Element) {
    this.callback(
      [{ target } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('MapBottomSheet', () => {
  it('renders the list content passed via state', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(<MapBottomSheet state={state} />);
    expect(screen.getByText(/エリアを選/)).toBeInTheDocument();
  });

  it('shrinks to content height when no condition is applied (要件 5.3)', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { getByTestId } = render(<MapBottomSheet state={state} />);
    expect(getByTestId('map-bottom-sheet').className).not.toMatch(
      /overflow-y-auto/,
    );
  });

  it('expands to a fixed scrollable height once any condition applies (filtered)', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = {
      kind: 'filtered',
      areaName: 'Aゾーン',
      keyword: '',
      categories: [],
      items: [],
    };
    const { getByTestId } = render(<MapBottomSheet state={state} />);
    expect(getByTestId('map-bottom-sheet').className).toMatch(
      /overflow-y-auto/,
    );
  });

  it.each([
    ['no-area', { kind: 'no-area' } satisfies AreaExhibitionListState],
    [
      'error',
      {
        kind: 'error',
        message: '取得に失敗しました',
      } satisfies AreaExhibitionListState,
    ],
  ])(
    'shrinks to content height for %s, which is a single-line notice with no real content',
    (_label, state) => {
      mockMatchMedia(false);
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      expect(getByTestId('map-bottom-sheet').className).not.toMatch(
        /overflow-y-auto/,
      );
    },
  );

  it('lets the map receive pointer events outside the sheet itself', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container, getByTestId } = render(<MapBottomSheet state={state} />);
    expect((container.firstChild as HTMLElement).className).toMatch(
      /pointer-events-none/,
    );
    expect(getByTestId('map-bottom-sheet').className).toMatch(
      /pointer-events-auto/,
    );
  });

  it('stays reachable by assistive tech and keyboard below the breakpoint', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).not.toHaveAttribute('inert');
  });

  it('is excluded from assistive tech and the tab order at/above the breakpoint', () => {
    mockMatchMedia(true);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper).toHaveAttribute('inert');
  });

  it('hides itself at/above the breakpoint via the shared MAP_BREAKPOINT prefix', () => {
    mockMatchMedia(true);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    const { container } = render(<MapBottomSheet state={state} />);
    expect((container.firstChild as HTMLElement).className).toMatch(
      /md:hidden/,
    );
  });

  it('forwards an optional notice to the exhibition list', () => {
    mockMatchMedia(false);
    const state: AreaExhibitionListState = { kind: 'unselected' };
    render(
      <MapBottomSheet state={state} notice="エリア情報の取得に失敗しました" />,
    );
    expect(
      screen.getByText('エリア情報の取得に失敗しました'),
    ).toBeInTheDocument();
  });

  describe('grabber', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('moves one snap step per arrow key and reflects it via aria-expanded', () => {
      mockMatchMedia(false);
      const state: AreaExhibitionListState = {
        kind: 'filtered',
        areaName: 'Aゾーン',
        keyword: '',
        categories: [],
        items: [],
      };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      const sheet = getByTestId('map-bottom-sheet');

      // 条件あり (filtered) の既定は「標準」(380px)。内容高 (auto) は飛ばして最小へ下がる
      expect(sheet.style.height).toBe('380px');
      expect(grabber).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.style.height).toBe('44px');
      expect(grabber).toHaveAccessibleName(/最小/);

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.style.height).toBe('44px');

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.style.height).toBe('380px');

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.style.height).toBe('55vh');
      expect(grabber).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.style.height).toMatch(/100dvh/);
      expect(grabber).toHaveAccessibleName(/全画面/);

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.style.height).toMatch(/100dvh/);

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.style.height).toBe('55vh');
    });

    it('lets Enter/Space toggle between the rest snap and one step up', () => {
      mockMatchMedia(false);
      const state: AreaExhibitionListState = { kind: 'unselected' };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      const sheet = getByTestId('map-bottom-sheet');

      expect(sheet.style.height).toBe('auto');

      fireEvent.keyDown(grabber, { key: 'Enter' });
      expect(sheet.style.height).toBe('380px');

      fireEvent.keyDown(grabber, { key: ' ' });
      expect(sheet.style.height).toBe('auto');

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.style.height).toBe('44px');
    });

    it('keeps content out of reach at the minimum snap', () => {
      mockMatchMedia(false);
      const state: AreaExhibitionListState = { kind: 'unselected' };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(getByTestId('map-bottom-sheet').className).toMatch(
        /overflow-hidden/,
      );
      expect(screen.getByText(/エリアを選/).closest('[inert]')).not.toBeNull();
    });

    it('follows the pointer continuously while dragging and snaps to the nearest position on release', () => {
      mockMatchMedia(false);
      window.innerHeight = 800;
      const state: AreaExhibitionListState = {
        kind: 'filtered',
        areaName: 'Aゾーン',
        keyword: '',
        categories: [],
        items: [],
      };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      const sheet = getByTestId('map-bottom-sheet');

      const rectSpy = vi
        .spyOn(sheet, 'getBoundingClientRect')
        .mockReturnValueOnce({ height: 380 } as DOMRect) // pointerdown: 開始高さ
        .mockReturnValueOnce({ height: 700 } as DOMRect); // pointerup: 離した時点の高さ

      firePointer(grabber, 'pointerdown', { clientY: 500 });
      firePointer(grabber, 'pointermove', { clientY: 480 }); // 閾値超えでドラッグ確定
      // ドラッグ中は遷移を切って指に追従させる
      expect(sheet.style.transition).toBe('none');
      firePointer(grabber, 'pointermove', { clientY: 100 }); // 確定地点から 380px 上へ

      // 380 + 380 = 760 (全画面 800 未満) をそのまま反映する
      expect(sheet.style.height).toBe('760px');

      firePointer(grabber, 'pointerup', { clientY: 100 });

      // 700 は 440 (大) より 800 (全画面) に近い
      expect(sheet.style.transition).toBe('');
      expect(sheet.style.height).toMatch(/100dvh/);
      expect(grabber).toHaveAccessibleName(/全画面/);

      rectSpy.mockRestore();
    });

    it('advances to the next snap in the flick direction even when the release height is nearer to the previous one', () => {
      mockMatchMedia(false);
      window.innerHeight = 800;
      const state: AreaExhibitionListState = {
        kind: 'filtered',
        areaName: 'Aゾーン',
        keyword: '',
        categories: [],
        items: [],
      };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      const sheet = getByTestId('map-bottom-sheet');
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      vi.spyOn(sheet, 'getBoundingClientRect')
        .mockReturnValueOnce({ height: 380 } as DOMRect)
        .mockReturnValueOnce({ height: 400 } as DOMRect); // 380 に最寄りだが勢いがある

      firePointer(grabber, 'pointerdown', { clientY: 500 });
      now = 1050;
      firePointer(grabber, 'pointermove', { clientY: 480 });
      now = 1060;
      firePointer(grabber, 'pointermove', { clientY: 470 });
      now = 1070;
      firePointer(grabber, 'pointerup', { clientY: 470 });

      // 50ms で 30px = 0.6px/ms の上向きフリック → 400 の次 (440) へ
      expect(sheet.style.height).toBe('55vh');
    });

    describe('dragging from the sheet body', () => {
      const filtered: AreaExhibitionListState = {
        kind: 'filtered',
        areaName: 'Aゾーン',
        keyword: '',
        categories: [],
        items: [],
      };

      it('resizes when dragging a non-scrollable body, and swallows the trailing click', () => {
        mockMatchMedia(false);
        window.innerHeight = 800;
        const onClick = vi.fn();
        const { getByTestId } = render(
          <MapBottomSheet state={{ kind: 'unselected' }} />,
        );
        const sheet = getByTestId('map-bottom-sheet');
        const body = screen.getByText(/エリアを選/);
        body.addEventListener('click', onClick);
        vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
          height: 100,
        } as DOMRect);

        firePointer(body, 'pointerdown', { clientY: 500 });
        firePointer(body, 'pointermove', { clientY: 480 });
        firePointer(body, 'pointermove', { clientY: 380 });
        expect(sheet.style.height).toBe('200px');
        firePointer(body, 'pointerup', { clientY: 380 });
        fireEvent.click(body);
        expect(onClick).not.toHaveBeenCalled();
      });

      it('leaves taps with sub-threshold movement alone', () => {
        mockMatchMedia(false);
        const onClick = vi.fn();
        const { getByTestId } = render(
          <MapBottomSheet state={{ kind: 'unselected' }} />,
        );
        const sheet = getByTestId('map-bottom-sheet');
        const body = screen.getByText(/エリアを選/);
        body.addEventListener('click', onClick);

        firePointer(body, 'pointerdown', { clientY: 500 });
        firePointer(body, 'pointermove', { clientY: 497 });
        firePointer(body, 'pointerup', { clientY: 497 });
        fireEvent.click(body);
        expect(sheet.style.transition).toBe('');
        expect(onClick).toHaveBeenCalledTimes(1);
      });

      it('does not claim horizontal-dominant moves', () => {
        mockMatchMedia(false);
        const { getByTestId } = render(
          <MapBottomSheet state={{ kind: 'unselected' }} />,
        );
        const sheet = getByTestId('map-bottom-sheet');
        const body = screen.getByText(/エリアを選/);

        firePointer(body, 'pointerdown', { clientY: 500, clientX: 100 });
        firePointer(body, 'pointermove', { clientY: 495, clientX: 160 });
        expect(sheet.style.transition).toBe('');
      });

      it('leaves a downward drag to list scrolling when the list is scrolled', () => {
        mockMatchMedia(false);
        const { getByTestId } = render(<MapBottomSheet state={filtered} />);
        const sheet = getByTestId('map-bottom-sheet');
        Object.defineProperty(sheet, 'scrollHeight', { value: 1000 });
        Object.defineProperty(sheet, 'clientHeight', { value: 380 });
        sheet.scrollTop = 50;
        const body = sheet.lastElementChild as HTMLElement;

        firePointer(body, 'pointerdown', { clientY: 300 });
        firePointer(body, 'pointermove', { clientY: 400 });
        expect(sheet.style.transition).toBe('');
      });

      it('shrinks the sheet on a downward drag when the list is at the top', () => {
        mockMatchMedia(false);
        const { getByTestId } = render(<MapBottomSheet state={filtered} />);
        const sheet = getByTestId('map-bottom-sheet');
        Object.defineProperty(sheet, 'scrollHeight', { value: 1000 });
        Object.defineProperty(sheet, 'clientHeight', { value: 380 });
        const body = sheet.lastElementChild as HTMLElement;

        firePointer(body, 'pointerdown', { clientY: 300 });
        firePointer(body, 'pointermove', { clientY: 400 });
        expect(sheet.style.transition).toBe('none');
      });
    });

    it('lifts a minimized sheet to the standard snap when an area gets selected, but never lowers a taller one', () => {
      mockMatchMedia(false);
      const state: AreaExhibitionListState = {
        kind: 'filtered',
        areaName: 'Aゾーン',
        keyword: '',
        categories: [],
        items: [],
      };
      const { getByTestId, rerender } = render(
        <MapBottomSheet state={state} selectedAreaId={1} />,
      );
      const sheet = getByTestId('map-bottom-sheet');
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.style.height).toBe('44px');
      rerender(<MapBottomSheet state={state} selectedAreaId={null} />);
      expect(sheet.style.height).toBe('44px');
      rerender(<MapBottomSheet state={state} selectedAreaId={2} />);
      expect(sheet.style.height).toBe('380px');

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      rerender(<MapBottomSheet state={state} selectedAreaId={3} />);
      expect(sheet.style.height).toBe('55vh');
    });

    it('reports its rendered height via ResizeObserver for the caller to follow', () => {
      mockMatchMedia(false);
      const onHeightChange = vi.fn();
      MockResizeObserver.instances.length = 0;
      vi.stubGlobal('ResizeObserver', MockResizeObserver);
      const state: AreaExhibitionListState = { kind: 'unselected' };
      const { getByTestId } = render(
        <MapBottomSheet state={state} onHeightChange={onHeightChange} />,
      );
      const sheet = getByTestId('map-bottom-sheet');

      expect(onHeightChange).toHaveBeenCalled();

      vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
        height: 380,
      } as DOMRect);
      const observer = MockResizeObserver.instances.at(-1);
      observer?.trigger(sheet);
      expect(onHeightChange).toHaveBeenLastCalledWith(380);

      vi.unstubAllGlobals();
    });
  });
});
