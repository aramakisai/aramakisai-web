// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignageTelopItem } from '@/lib/signage';
import { SignageTelop } from './signage-telop';

const item: SignageTelopItem = {
  id: 1,
  audience: 'visitor',
  target: 'ご来場のみなさまへ',
  body: 'お知らせ',
} as SignageTelopItem;

describe('SignageTelop', () => {
  let rafCalls = 0;
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    vi.stubGlobal('requestAnimationFrame', () => ++rafCalls);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    rafCalls = 0;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { status: 'loaded' },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('テロップが0件になったら計測を捨てて描画ループを止める', () => {
    const { rerender } = render(
      <SignageTelop items={[item]} orientation="landscape" offsetMs={0} />,
    );
    expect(rafCalls).toBeGreaterThan(0);
    rerender(<SignageTelop items={[]} orientation="landscape" offsetMs={0} />);
    const afterEmpty = rafCalls;
    rerender(<SignageTelop items={[]} orientation="landscape" offsetMs={1} />);
    expect(rafCalls).toBe(afterEmpty);
  });
});
