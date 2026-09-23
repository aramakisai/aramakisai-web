import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouter } from 'next/navigation';
import { PhaseToggle } from './phase-toggle';
import { PHASE_OVERRIDE_COOKIE } from '@/lib/phase';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);

describe('PhaseToggle', () => {
  const refresh = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    mockedUseRouter.mockReturnValue({
      refresh,
    } as unknown as ReturnType<typeof useRouter>);
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=; path=/; max-age=0`;
  });

  afterEach(() => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=; path=/; max-age=0`;
  });

  it('現在のフェーズと適用元 (定数) を表示する', () => {
    render(
      <PhaseToggle resolved={{ phase: 'pre_event', source: 'constant' }} />,
    );
    expect(screen.getByText('開催前')).toBeInTheDocument();
    expect(screen.getByText(/定数/)).toBeInTheDocument();
    expect(screen.queryByText(/オーバーライド/)).not.toBeInTheDocument();
  });

  it('適用元がオーバーライドのとき、その旨を表示する', () => {
    render(<PhaseToggle resolved={{ phase: 'live', source: 'override' }} />);
    expect(screen.getByText('開催中')).toBeInTheDocument();
    expect(screen.getByText(/オーバーライド/)).toBeInTheDocument();
  });

  it('操作要素を開くと切り替えボタンが現れ、押すとオーバーライド Cookie を書き込みページを再取得する', () => {
    render(
      <PhaseToggle resolved={{ phase: 'pre_event', source: 'constant' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /開催前/ }));
    fireEvent.click(screen.getByRole('button', { name: '開催中に切り替える' }));

    expect(document.cookie).toContain(`${PHASE_OVERRIDE_COOKIE}=live`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('適用元が定数のとき、解除ボタンは表示されない', () => {
    render(
      <PhaseToggle resolved={{ phase: 'pre_event', source: 'constant' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /開催前/ }));
    expect(
      screen.queryByRole('button', { name: 'オーバーライドを解除する' }),
    ).not.toBeInTheDocument();
  });

  it('適用元がオーバーライドのとき、解除ボタンで Cookie を削除しページを再取得する', () => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=live; path=/`;
    render(<PhaseToggle resolved={{ phase: 'live', source: 'override' }} />);

    fireEvent.click(screen.getByRole('button', { name: /開催中/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'オーバーライドを解除する' }),
    );

    expect(document.cookie).not.toContain(`${PHASE_OVERRIDE_COOKIE}=live`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('開催中フェーズでは 1024px 未満で下部ナビゲーションの上へずらす', () => {
    const { container } = render(
      <PhaseToggle resolved={{ phase: 'live', source: 'constant' }} />,
    );
    expect(container.firstChild).toHaveClass(
      'max-lg:bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]',
    );
  });

  it('開催前フェーズでは下部ナビゲーションが出ないため、ずらさない', () => {
    const { container } = render(
      <PhaseToggle resolved={{ phase: 'pre_event', source: 'constant' }} />,
    );
    expect(container.firstChild).not.toHaveClass(
      'max-lg:bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]',
    );
  });
});
