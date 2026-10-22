import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/a',
  search: new URLSearchParams(),
  vitals: undefined as undefined | ((m: unknown) => void),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.search,
}));
vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (cb: (m: unknown) => void) => {
    mocks.vitals = cb;
  },
}));
vi.mock('@/lib/analytics', () => ({
  loadGtag: vi.fn(),
  trackPageView: vi.fn(),
  setPageLocation: vi.fn(),
  sendGaEvent: vi.fn(),
  sanitizeLocation: (h: string) => h,
}));
vi.mock('@/lib/client-capabilities', () => ({
  detectCapabilities: () => ({ cap_storage: '1' }),
}));

import * as analytics from '@/lib/analytics';
import { GoogleAnalytics } from './google-analytics';

const set = (p: string, q = '') => {
  mocks.pathname = p;
  mocks.search = new URLSearchParams(q);
};

describe('GoogleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    set('/a');
  });

  it('マウント時に gtag.js の読み込みと page_view を始める', () => {
    render(<GoogleAnalytics />);
    expect(analytics.loadGtag).toHaveBeenCalledOnce();
    expect(analytics.trackPageView).toHaveBeenCalledOnce();
  });

  it('パスの変化だけで page_view、クエリ変化では URL の設定だけ', () => {
    const { rerender } = render(<GoogleAnalytics />);
    set('/a', 'category=x');
    rerender(<GoogleAnalytics />);
    set('/a', 'category=x&page=2');
    rerender(<GoogleAnalytics />);
    set('/a', 'category=y');
    rerender(<GoogleAnalytics />);
    expect(analytics.trackPageView).toHaveBeenCalledTimes(1);
    expect(analytics.setPageLocation).toHaveBeenCalledTimes(3);
    set('/b', 'category=y');
    rerender(<GoogleAnalytics />);
    expect(analytics.trackPageView).toHaveBeenCalledTimes(2);
  });

  it('再描画しても useReportWebVitals に同じ関数を渡す', () => {
    const { rerender } = render(<GoogleAnalytics />);
    const first = mocks.vitals;
    set('/b');
    rerender(<GoogleAnalytics />);
    expect(mocks.vitals).toBe(first);
  });

  it('Web Vitals は 5 指標だけを最初のパスと合わせて送る', () => {
    const { rerender } = render(<GoogleAnalytics />);
    set('/b');
    rerender(<GoogleAnalytics />);
    for (const name of [
      'LCP',
      'CLS',
      'INP',
      'FCP',
      'TTFB',
      'FID',
      'Next.js-hydration',
    ]) {
      mocks.vitals!({ name, value: 1, rating: 'good' });
    }
    const calls = vi
      .mocked(analytics.sendGaEvent)
      .mock.calls.filter((c) => c[0] === 'web_vitals');
    expect(
      calls.map((c) => (c[1] as { metric_name: string }).metric_name),
    ).toEqual(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']);
    expect((calls[0][1] as { vitals_page: string }).vitals_page).toContain('/');
  });

  it('端末の対応状況はタブ内で 1 回だけ送る', () => {
    const { unmount } = render(<GoogleAnalytics />);
    unmount();
    render(<GoogleAnalytics />);
    const caps = vi
      .mocked(analytics.sendGaEvent)
      .mock.calls.filter((c) => c[0] === 'client_capabilities');
    expect(caps).toHaveLength(1);
  });

  it('sessionStorage が使えない端末では読み込みごとに送る', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<GoogleAnalytics />);
    render(<GoogleAnalytics />);
    const caps = vi
      .mocked(analytics.sendGaEvent)
      .mock.calls.filter((c) => c[0] === 'client_capabilities');
    vi.restoreAllMocks();
    expect(caps).toHaveLength(2);
  });
});
