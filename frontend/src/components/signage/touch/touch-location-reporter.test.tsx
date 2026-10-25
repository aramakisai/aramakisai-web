// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

let pathname = '/signage/touch/map';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import {
  TouchLocationReporter,
  useReportTouchFilters,
} from './touch-location-reporter';

const parentPost = vi.fn();
function asChild() {
  vi.spyOn(window, 'parent', 'get').mockReturnValue({
    postMessage: parentPost,
  } as unknown as Window);
}
afterEach(() => {
  vi.restoreAllMocks();
  parentPost.mockReset();
});

it('iframe でなければ何も送らない', () => {
  const spy = vi.spyOn(window, 'postMessage');
  render(<TouchLocationReporter />);
  expect(spy).not.toHaveBeenCalled();
});

it('表示時と遷移時に自オリジン宛てでパスを送る', () => {
  asChild();
  const r = render(<TouchLocationReporter />);
  expect(parentPost).toHaveBeenLastCalledWith(
    { type: 'signage-touch-path', path: '/signage/touch/map' },
    window.location.origin,
  );
  pathname = '/signage/touch/exhibitions/3/stage';
  r.rerender(<TouchLocationReporter />);
  expect(parentPost).toHaveBeenLastCalledWith(
    { type: 'signage-touch-path', path: '/signage/touch/exhibitions/3/stage' },
    window.location.origin,
  );
});

it('絞り込みの変更のたびに path 付きで送る', () => {
  asChild();
  pathname = '/signage/touch/exhibitions';
  const f1 = { q: '', categories: [], areaIds: [], page: 1 } as const;
  const f2 = { ...f1, categories: ['stage'] } as never;
  function C({ f }: { f: never }) {
    useReportTouchFilters(f);
    return null;
  }
  const r = render(<C f={f1 as never} />);
  r.rerender(<C f={f2} />);
  expect(parentPost).toHaveBeenCalledTimes(2);
  expect(parentPost).toHaveBeenLastCalledWith(
    { type: 'signage-touch-filters', path: pathname, filters: f2 },
    window.location.origin,
  );
});
