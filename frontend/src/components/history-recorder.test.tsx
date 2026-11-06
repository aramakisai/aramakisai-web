import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryRecorder } from './history-recorder';
import * as storage from '@/lib/mypage-storage';

describe('HistoryRecorder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('マウント時に1回だけ記録し、何も描画しない', () => {
    const spy = vi.spyOn(storage, 'recordHistory');
    const { container } = render(
      <HistoryRecorder exhibitionId={3} category="stage" />,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(3, 'stage');
    expect(container).toBeEmptyDOMElement();
  });

  it('再描画では記録せず、企画が切り替わると1回記録する', () => {
    const spy = vi.spyOn(storage, 'recordHistory');
    const { rerender } = render(
      <HistoryRecorder exhibitionId={3} category="stage" />,
    );
    rerender(<HistoryRecorder exhibitionId={3} category="stage" />);
    expect(spy).toHaveBeenCalledTimes(1);
    rerender(<HistoryRecorder exhibitionId={4} category="vendor" />);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(4, 'vendor');
  });

  it('端末内保存に履歴が増える', () => {
    render(<HistoryRecorder exhibitionId={3} category="stage" />);
    const data = JSON.parse(
      window.localStorage.getItem('aramakisai_mypage') ?? 'null',
    );
    expect(data.lists.history).toEqual([
      expect.objectContaining({ id: 3, category: 'stage' }),
    ]);
  });

  it('保存不可でも例外を出さない', () => {
    vi.spyOn(storage, 'recordHistory').mockReturnValue('unavailable');
    expect(() =>
      render(<HistoryRecorder exhibitionId={3} category="stage" />),
    ).not.toThrow();
  });
});
