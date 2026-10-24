import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from './map-bottom-sheet-shell';

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

describe('MapBottomSheetShell', () => {
  it('reduced motion時はsnap遷移を無効化する', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<Harness />);
    expect(screen.getByTestId('map-bottom-sheet')).toHaveClass(
      'motion-reduce:transition-none',
    );
  });

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
});
