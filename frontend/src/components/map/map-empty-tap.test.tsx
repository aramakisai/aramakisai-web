import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handlers = Record<string, (e?: unknown) => void>;
let handlers: Handlers = {};

vi.mock('react-leaflet', () => ({
  useMapEvents: (h: Handlers) => {
    handlers = h;
    return null;
  },
}));

import { DOUBLE_TAP_TIMEOUT_MS, MapEmptyTap } from './map-empty-tap';

const click = (detail: number) => handlers.click({ originalEvent: { detail } });

describe('MapEmptyTap', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('detail=1 の click から待ち時間後に onTap を呼ぶ', () => {
    const onTap = vi.fn();
    render(<MapEmptyTap onTap={onTap} />);
    click(1);
    vi.advanceTimersByTime(DOUBLE_TAP_TIMEOUT_MS - 1);
    expect(onTap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['preclick', () => handlers.preclick()],
    ['dblclick', () => handlers.dblclick()],
    ['detail=2 の click', () => click(2)],
  ])('%s で取り消す', (_, cancel) => {
    const onTap = vi.fn();
    render(<MapEmptyTap onTap={onTap} />);
    click(1);
    cancel();
    vi.advanceTimersByTime(DOUBLE_TAP_TIMEOUT_MS * 2);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('アンマウントでタイマーを消す', () => {
    const onTap = vi.fn();
    const { unmount } = render(<MapEmptyTap onTap={onTap} />);
    click(1);
    unmount();
    vi.advanceTimersByTime(DOUBLE_TAP_TIMEOUT_MS * 2);
    expect(onTap).not.toHaveBeenCalled();
  });
});
