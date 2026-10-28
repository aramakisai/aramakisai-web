import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from './map-bottom-sheet-shell';

function firePointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  props: { clientY: number; clientX?: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 0, ...props });
  fireEvent(element, event);
}

const regionalSnaps: readonly MapBottomSheetSnap[] = [
  {
    id: 'collapsed',
    label: '縮小',
    height: '112px',
    resolveHeightPx: () => 112,
    overflow: 'hidden',
    contentInert: true,
  },
  {
    id: 'list',
    label: '一覧',
    height: '360px',
    resolveHeightPx: () => 360,
    overflow: 'auto',
  },
  {
    id: 'detail',
    label: '詳細',
    height: '620px',
    resolveHeightPx: () => 620,
    overflow: 'auto',
  },
];

function Harness() {
  const [snapId, setSnapId] = useState('list');
  return (
    <MapBottomSheetShell
      snaps={regionalSnaps}
      snapId={snapId}
      restSnapId="list"
      onSnapChange={setSnapId}
    >
      <p>地域協賛の内容</p>
    </MapBottomSheetShell>
  );
}

function renderNestedScrollArea(scrollTop: number) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  render(
    <MapBottomSheetShell
      snaps={regionalSnaps}
      snapId="detail"
      restSnapId="list"
      onSnapChange={vi.fn()}
    >
      <div data-map-sheet-scroll>
        <span>scroll内容</span>
      </div>
    </MapBottomSheetShell>,
  );
  const sheet = screen.getByTestId('map-bottom-sheet');
  const scrollArea = screen.getByText('scroll内容').parentElement!;
  Object.defineProperty(scrollArea, 'scrollHeight', { value: 1000 });
  Object.defineProperty(scrollArea, 'clientHeight', { value: 620 });
  scrollArea.scrollTop = scrollTop;
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
    height: 620,
  } as DOMRect);
  return { sheet, scrollArea };
}

describe('MapBottomSheetShell', () => {
  it('内容と一覧用・詳細用の高さ設定を受け取る', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<Harness />);

    const sheet = screen.getByTestId('map-bottom-sheet');
    const grabber = screen.getByRole('button', {
      name: /シートの高さを変更/,
    });
    expect(screen.getByText('地域協賛の内容')).toBeInTheDocument();
    expect(sheet.style.height).toBe('360px');

    fireEvent.keyDown(grabber, { key: 'ArrowUp' });
    expect(sheet.style.height).toBe('620px');
    expect(grabber).toHaveAccessibleName(/詳細/);
  });

  it('PCではシート全体、縮小snapでは内容だけをinertにする', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const { unmount } = render(<Harness />);
    const sheet = screen.getByTestId('map-bottom-sheet');
    expect(sheet.parentElement).toHaveAttribute('inert');
    unmount();

    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<Harness />);
    const grabber = screen.getByRole('button', {
      name: /シートの高さを変更/,
    });
    fireEvent.keyDown(grabber, { key: 'ArrowDown' });
    expect(screen.getByText('地域協賛の内容').parentElement).toHaveAttribute(
      'inert',
    );
  });

  it('内側のscroll領域が途中なら、その領域の縦scrollをsheet resizeより優先する', () => {
    const { sheet, scrollArea } = renderNestedScrollArea(50);

    firePointer(scrollArea, 'pointerdown', { clientY: 300 });
    firePointer(scrollArea, 'pointermove', { clientY: 400 });

    expect(sheet.style.transition).toBe('');
    firePointer(scrollArea, 'pointerup', { clientY: 400 });
  });

  it('最大snapでは内側scroll領域の上方向scrollをsheet resizeより優先する', () => {
    const { sheet, scrollArea } = renderNestedScrollArea(0);

    firePointer(scrollArea, 'pointerdown', { clientY: 300 });
    firePointer(scrollArea, 'pointermove', { clientY: 200 });

    expect(sheet.style.transition).toBe('');
    firePointer(scrollArea, 'pointerup', { clientY: 200 });
  });

  it('内側scroll領域が先頭なら下方向dragでsheetを縮小する', () => {
    const { sheet, scrollArea } = renderNestedScrollArea(0);

    firePointer(scrollArea, 'pointerdown', { clientY: 300 });
    firePointer(scrollArea, 'pointermove', { clientY: 400 });

    expect(sheet.style.transition).toBe('none');
    firePointer(scrollArea, 'pointerup', { clientY: 400 });
  });

  it('下端オフセットをdrag上限から差し引き、呼び出し側固有の装飾を適用する', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.innerHeight = 800;
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = originalGetComputedStyle(element);
      if ((element as HTMLElement).classList.contains('bottom-nav-test')) {
        return new Proxy(style, {
          get(target, property) {
            if (property === 'bottom') return '64px';
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      }
      return style;
    });
    const insetSnaps: readonly MapBottomSheetSnap[] = [
      {
        id: 'rest',
        label: '標準',
        height: '380px',
        resolveHeightPx: () => 380,
        overflow: 'auto',
      },
      {
        id: 'full',
        label: '全画面',
        height: 'calc(100dvh - var(--bottom-nav))',
        resolveHeightPx: ({ viewportHeight, bottomInset }) =>
          viewportHeight - bottomInset,
        overflow: 'auto',
        fullScreen: true,
      },
    ];
    const onSnapChange = vi.fn();
    render(
      <MapBottomSheetShell
        snaps={insetSnaps}
        snapId="rest"
        restSnapId="rest"
        onSnapChange={onSnapChange}
        outerClassName="bottom-nav-test clip-bottom-shadow"
        sheetShadowClassName="shadow-card"
      >
        <p>オフセット確認</p>
      </MapBottomSheetShell>,
    );
    const sheet = screen.getByTestId('map-bottom-sheet');
    const wrapper = sheet.parentElement!;
    const grabber = screen.getByRole('button', {
      name: /シートの高さを変更/,
    });
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
      height: 720,
    } as DOMRect);

    firePointer(grabber, 'pointerdown', { clientY: 500 });
    firePointer(grabber, 'pointermove', { clientY: 480 });
    firePointer(grabber, 'pointermove', { clientY: -500 });

    expect(sheet.style.height).toBe('736px');
    expect(wrapper).toHaveClass(
      'bottom-[var(--map-nav,0px)]',
      'clip-bottom-shadow',
    );
    expect(sheet).toHaveClass('shadow-card');

    firePointer(grabber, 'pointerup', { clientY: -500 });
    expect(onSnapChange).toHaveBeenCalledWith('full');
    vi.restoreAllMocks();
  });

  it('snap を切り替えた commit で移動先の高さを通知する', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const onTargetHeightChange = vi.fn();
    const { rerender } = render(
      <MapBottomSheetShell
        snaps={regionalSnaps}
        snapId="list"
        restSnapId="list"
        onSnapChange={() => {}}
        onTargetHeightChange={onTargetHeightChange}
      >
        <p>地域協賛の内容</p>
      </MapBottomSheetShell>,
    );
    expect(onTargetHeightChange).toHaveBeenLastCalledWith(360);

    rerender(
      <MapBottomSheetShell
        snaps={regionalSnaps}
        snapId="detail"
        restSnapId="list"
        onSnapChange={() => {}}
        onTargetHeightChange={onTargetHeightChange}
      >
        <p>地域協賛の内容</p>
      </MapBottomSheetShell>,
    );
    expect(onTargetHeightChange).toHaveBeenLastCalledWith(620);
  });
});
