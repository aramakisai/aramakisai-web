import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignageBubbles } from './signage-bubbles';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));
vi.mock('@/lib/cms', () => ({ cms: {} }));

const bubbles = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-bubble]'));

describe('SignageBubbles', () => {
  it('横型は 9 個、縦型は 11 個描く', () => {
    expect(
      bubbles(render(<SignageBubbles orientation="landscape" />).container),
    ).toHaveLength(9);
    expect(
      bubbles(render(<SignageBubbles orientation="portrait" />).container),
    ).toHaveLength(11);
  });

  it('animation-delay は -phase × 所要 (横型 L 80s・phase 0.30 / Inf 60s・phase 0.50 / S 40s・phase 0.15)', () => {
    const el = bubbles(
      render(<SignageBubbles orientation="landscape" />).container,
    );
    expect(el[0].style.animation).toContain('80s linear -24s');
    expect(el[2].style.animation).toContain('60s linear -30s');
    expect(el[3].style.animation).toContain('40s linear -6s');
  });

  it('縦型の所要は横型の倍 (S 80s・phase 0.08)', () => {
    const el = bubbles(
      render(<SignageBubbles orientation="portrait" />).container,
    );
    expect(el[4].style.animation).toContain('80s linear -6.4s');
  });

  it('Inf は輪を 2 つ 1 組で描く', () => {
    const { container } = render(<SignageBubbles orientation="landscape" />);
    expect(container.querySelectorAll('[data-bg-ring]')).toHaveLength(2);
  });
});
