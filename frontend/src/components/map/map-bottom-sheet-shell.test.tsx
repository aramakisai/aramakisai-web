import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('ドラッグ中は通知せず、指を離して snap が決まったときに移動先の高さを通知する', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const onTargetHeightChange = vi.fn();
    function Controlled() {
      const [snapId, setSnapId] = useState('list');
      return (
        <MapBottomSheetShell
          snaps={regionalSnaps}
          snapId={snapId}
          restSnapId="list"
          onSnapChange={setSnapId}
          onTargetHeightChange={onTargetHeightChange}
        >
          <p>地域協賛の内容</p>
        </MapBottomSheetShell>
      );
    }
    render(<Controlled />);
    const sheet = screen.getByTestId('map-bottom-sheet');
    const grabber = screen.getByRole('button', { name: /シートの高さを変更/ });
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
      height: 360,
    } as DOMRect);
    onTargetHeightChange.mockClear();

    firePointer(grabber, 'pointerdown', { clientY: 500 });
    firePointer(grabber, 'pointermove', { clientY: 450 });
    firePointer(grabber, 'pointermove', { clientY: 300 });
    expect(onTargetHeightChange).not.toHaveBeenCalled();

    firePointer(grabber, 'pointerup', { clientY: 100 });
    expect(onTargetHeightChange).toHaveBeenCalledTimes(1);
    expect(onTargetHeightChange).toHaveBeenLastCalledWith(620);
    vi.restoreAllMocks();
  });

  it('シートが非表示 (PC 幅) のときは 0 を通知する', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const onTargetHeightChange = vi.fn();
    const tree = (
      <MapBottomSheetShell
        snaps={regionalSnaps}
        snapId="list"
        restSnapId="list"
        onSnapChange={vi.fn()}
        onTargetHeightChange={onTargetHeightChange}
      >
        <p>内容</p>
      </MapBottomSheetShell>
    );
    const { rerender } = render(tree);
    expect(onTargetHeightChange).toHaveBeenLastCalledWith(360);
    screen.getByTestId('map-bottom-sheet').parentElement!.style.display =
      'none';
    rerender(<MapBottomSheetShell {...tree.props} snapId="detail" />);
    expect(onTargetHeightChange).toHaveBeenLastCalledWith(0);
  });

  it('マウント直後は高さの transition を掛けず、描画が落ち着いてから有効にする', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<Harness />);
    const sheet = screen.getByTestId('map-bottom-sheet');
    expect(sheet.className).not.toContain('duration-300');
    await waitFor(() => expect(sheet.className).toContain('duration-300'));
  });

  it('fit (height:auto) から出るとき、内容が替わる前の実高さを起点に固定してから移動先へ向ける', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const snaps: readonly MapBottomSheetSnap[] = [
      {
        id: 'fit',
        label: '折りたたみ',
        height: 'auto',
        resolveHeightPx: () => 120,
        overflow: 'hidden',
      },
      regionalSnaps[1]!,
    ];
    const tree = (snapId: string) => (
      <MapBottomSheetShell
        snaps={snaps}
        snapId={snapId}
        restSnapId="fit"
        onSnapChange={vi.fn()}
      >
        <p>内容</p>
      </MapBottomSheetShell>
    );
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 120 } as DOMRect);
    const { rerender } = render(tree('fit'));
    const sheet = screen.getByTestId('map-bottom-sheet');
    const written: string[] = [];
    let current = sheet.style.height;
    Object.defineProperty(sheet.style, 'height', {
      configurable: true,
      get: () => current,
      set: (value: string) => {
        written.push(value);
        current = value;
      },
    });

    rerender(tree('list'));

    // 先頭は React の反映。その後に実高さへ固定し直してから移動先へ向ける
    expect(written).toEqual(['360px', '120px', '360px']);
    rect.mockRestore();
  });

  describe('transition 中の通知', () => {
    function setup() {
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      const onTargetHeightChange = vi.fn();
      const tree = (snapId: string) => (
        <MapBottomSheetShell
          snaps={regionalSnaps}
          snapId={snapId}
          restSnapId="list"
          onSnapChange={vi.fn()}
          onTargetHeightChange={onTargetHeightChange}
        >
          <p>内容</p>
        </MapBottomSheetShell>
      );
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
        const style = realGetComputedStyle(el, pseudo);
        return el instanceof HTMLElement &&
          el.dataset.testid === 'map-bottom-sheet'
          ? ({
              ...style,
              transitionDuration: '0.3s',
              paddingTop: '0',
              paddingBottom: '0',
            } as unknown as CSSStyleDeclaration)
          : style;
      });
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        height: 360,
      } as DOMRect);
      const view = render(tree('list'));
      return { ...view, tree, onTargetHeightChange };
    }
    const end = (sheet: HTMLElement, propertyName = 'height') => {
      const event = new Event('transitionend', { bubbles: true });
      Object.assign(event, { propertyName });
      fireEvent(sheet, event);
    };

    it('伸びる向きは height の transition が終わってから通知する', () => {
      const { rerender, tree, onTargetHeightChange } = setup();
      onTargetHeightChange.mockClear();
      rerender(tree('detail'));
      expect(onTargetHeightChange).not.toHaveBeenCalled();

      const sheet = screen.getByTestId('map-bottom-sheet');
      end(sheet, 'opacity');
      expect(onTargetHeightChange).not.toHaveBeenCalled();
      end(sheet);
      expect(onTargetHeightChange).toHaveBeenCalledTimes(1);
      expect(onTargetHeightChange).toHaveBeenCalledWith(620);
      vi.restoreAllMocks();
    });

    it('縮む向きは即時に通知し、伸びる途中の保留は取り消す', () => {
      const { rerender, tree, onTargetHeightChange } = setup();
      rerender(tree('detail'));
      onTargetHeightChange.mockClear();

      rerender(tree('collapsed'));
      expect(onTargetHeightChange).toHaveBeenCalledTimes(1);
      expect(onTargetHeightChange).toHaveBeenLastCalledWith(112);

      end(screen.getByTestId('map-bottom-sheet'));
      expect(onTargetHeightChange).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });
  });
});
