// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('@/components/signage/touch/touch-link-guard', () => ({
  TouchLinkGuard: () => null,
}));
vi.mock('@/components/signage/touch/touch-location-reporter', () => ({
  TouchLocationReporter: () => null,
}));

import TouchLayout from './layout';

it('端末用ページはスクロールバーを隠す', () => {
  const { container } = render(
    <TouchLayout>
      <p>中身</p>
    </TouchLayout>,
  );
  const css = container.querySelector('style')?.textContent ?? '';
  expect(css).toContain('scrollbar-width:none');
  expect(css).toContain('::-webkit-scrollbar{display:none}');
});
