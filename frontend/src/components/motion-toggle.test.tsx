import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { MotionToggle } from './motion-toggle';

vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: vi.fn(),
}));

const mockUseMotionPreference = vi.mocked(useMotionPreference);

beforeEach(() => {
  mockUseMotionPreference.mockReset();
});

describe('MotionToggle', () => {
  it('再生中 (reduced=false) は pause アイコンを表示し、aria-pressed が true になる (要件 21.5)', () => {
    mockUseMotionPreference.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
    render(<MotionToggle />);

    const button = screen.getByRole('button', { name: 'モーション' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('icon-pause')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-play-arrow')).not.toBeInTheDocument();
  });

  it('停止中 (reduced=true) は play_arrow アイコンを表示し、aria-pressed が false になる (要件 21.5)', () => {
    mockUseMotionPreference.mockReturnValue({ reduced: true, toggle: vi.fn() });
    render(<MotionToggle />);

    const button = screen.getByRole('button', { name: 'モーション' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('icon-play-arrow')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-pause')).not.toBeInTheDocument();
  });

  it('ラベルは状態によらず「モーション」で固定する (要件 21.5)', () => {
    mockUseMotionPreference.mockReturnValue({ reduced: true, toggle: vi.fn() });
    const { rerender } = render(<MotionToggle />);
    expect(screen.getByText('モーション')).toBeInTheDocument();

    mockUseMotionPreference.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
    rerender(<MotionToggle />);
    expect(screen.getByText('モーション')).toBeInTheDocument();
  });

  it('押すと共有フックの toggle を呼び出す (要件 21.6, 21.7 は共有フック側の責務)', () => {
    const toggle = vi.fn();
    mockUseMotionPreference.mockReturnValue({ reduced: false, toggle });
    render(<MotionToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'モーション' }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('タップ領域を 44px 以上確保するため、可視のピルの外側へ見えないヒット領域を広げる', () => {
    mockUseMotionPreference.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
    render(<MotionToggle />);

    const button = screen.getByRole('button', { name: 'モーション' });
    expect(button.className).toMatch(/before:-inset-y-\[6px\]/);
  });

  it('pill 型の枠付きの見た目とホバー時の地の色変化のクラスを持つ', () => {
    mockUseMotionPreference.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
    render(<MotionToggle />);

    const button = screen.getByRole('button', { name: 'モーション' });
    expect(button.className).toMatch(/rounded-full/);
    expect(button.className).toMatch(/border-gray-500/);
    expect(button.className).toMatch(/hover:bg-gray-100/);
  });
});
