import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapBottomSheet } from './map-bottom-sheet';
import type { AreaExhibitionListState } from './area-exhibition-list';

// jsdom は PointerEvent を生成できない (document.createEvent('PointerEvent') が
// 例外を投げる) ため、必要なプロパティを持つ汎用 Event を代わりに送出する
function firePointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  props: { clientY: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, ...props });
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

      // 条件あり (filtered) の既定は「中」(380px)。折りたたみへは戻れない
      expect(sheet.className).toMatch(/h-\[380px\]/);
      expect(grabber).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.className).toMatch(/h-\[380px\]/);

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.className).toMatch(/h-\[55vh\]/);
      expect(grabber).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(grabber, { key: 'ArrowUp' });
      expect(sheet.className).toMatch(/h-\[55vh\]/);

      fireEvent.keyDown(grabber, { key: 'ArrowDown' });
      expect(sheet.className).toMatch(/h-\[380px\]/);
    });

    it('lets Enter/Space toggle between the floor and one step up', () => {
      mockMatchMedia(false);
      const state: AreaExhibitionListState = { kind: 'unselected' };
      const { getByTestId } = render(<MapBottomSheet state={state} />);
      const grabber = screen.getByRole('button', {
        name: /シートの高さを変更/,
      });
      const sheet = getByTestId('map-bottom-sheet');

      expect(sheet.className).not.toMatch(/h-\[/);

      fireEvent.keyDown(grabber, { key: 'Enter' });
      expect(sheet.className).toMatch(/h-\[380px\]/);

      fireEvent.keyDown(grabber, { key: ' ' });
      expect(sheet.className).not.toMatch(/h-\[/);
    });

    it('follows the pointer continuously while dragging and snaps to the nearest position on release', () => {
      mockMatchMedia(false);
      window.innerHeight = 800; // 最大スナップ = 55vh = 440px
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
        .mockReturnValueOnce({ height: 1000 } as DOMRect); // pointerup: 離した時点の高さ

      firePointer(grabber, 'pointerdown', { clientY: 500 });
      firePointer(grabber, 'pointermove', { clientY: 400 }); // 100px 上へドラッグ

      // 380 + 100 = 480 は上限 440 でクランプされ、連続して追従する
      expect(sheet.style.height).toBe('440px');

      firePointer(grabber, 'pointerup', { clientY: 400 });

      // 離した高さ (1000) は 440 (最大) に最も近いのでそこへスナップする
      expect(sheet.style.height).toBe('');
      expect(sheet.className).toMatch(/h-\[55vh\]/);

      rectSpy.mockRestore();
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
