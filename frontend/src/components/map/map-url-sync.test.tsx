import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

import { MapUrlSync } from './map-url-sync';

describe('MapUrlSync', () => {
  it('マウント時と useSearchParams の変化時に onChange を呼ぶ', () => {
    const onChange = vi.fn();
    search = 'area=54';
    const { rerender } = render(<MapUrlSync onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<MapUrlSync onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(1);
    search = '';
    rerender(<MapUrlSync onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
