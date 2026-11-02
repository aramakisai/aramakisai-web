// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SignageTrialOverlay } from './signage-trial-overlay';

it('試験中でなければ何も描かない', () => {
  const { container } = render(<SignageTrialOverlay trialShiftMs={null} />);
  expect(container.firstChild).toBeNull();
});

it('試験中は全面に重なり、タップを通し、読み上げ対象から外れる', () => {
  const { container } = render(<SignageTrialOverlay trialShiftMs={0} />);
  const layer = container.firstElementChild as HTMLElement;
  expect(layer.textContent).toBe('試験中');
  expect(layer.getAttribute('aria-hidden')).toBe('true');
  expect(layer.className).toContain('pointer-events-none');
  expect(layer.className).toContain('absolute');
  expect(layer.className).toContain('inset-0');
  const text = layer.firstElementChild as HTMLElement;
  for (const c of [
    'font-display',
    'font-bold',
    'text-text',
    'text-[280px]',
    'leading-none',
    'opacity-15',
  ]) {
    expect(text.className).toContain(c);
  }
});
