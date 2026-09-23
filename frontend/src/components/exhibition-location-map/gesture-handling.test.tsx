import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mapMock: {
  getContainer: () => HTMLElement;
  scrollWheelZoom: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
  };
};
let mapWrapper: HTMLDivElement;
let mapContainerEl: HTMLDivElement;

vi.mock('react-leaflet', () => ({
  useMap: () => mapMock,
}));

import { GestureHandling } from './gesture-handling';

describe('GestureHandling', () => {
  beforeEach(() => {
    // MapContainer 本体 (leaflet-container 相当) とその親要素を用意する。
    // wheel は親要素で capture するため、テストでも親要素へ発火する。
    // addEventListener/dispatchEvent は document への接続を要らないため、
    // render() が用いる別のコンテナと衝突させないよう独立させておく
    mapWrapper = document.createElement('div');
    mapContainerEl = document.createElement('div');
    mapWrapper.appendChild(mapContainerEl);

    mapMock = {
      getContainer: () => mapContainerEl,
      scrollWheelZoom: { enable: vi.fn(), disable: vi.fn() },
    };
  });

  it('Ctrl キーなしの wheel はズームを無効化しヒントを表示する', () => {
    render(<GestureHandling />);

    fireEvent.wheel(mapWrapper);

    expect(mapMock.scrollWheelZoom.disable).toHaveBeenCalled();
    expect(mapMock.scrollWheelZoom.enable).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ctrl キー (Mac は ⌘) を押しながらスクロールすると拡大縮小できます',
    );
  });

  it('Ctrl キー併用の wheel はズームを有効化する', () => {
    render(<GestureHandling />);

    fireEvent.wheel(mapWrapper, { ctrlKey: true });

    expect(mapMock.scrollWheelZoom.enable).toHaveBeenCalled();
    expect(mapMock.scrollWheelZoom.disable).not.toHaveBeenCalled();
  });
});
