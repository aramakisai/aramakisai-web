'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import {
  loadGtag,
  sanitizeLocation,
  sendGaEvent,
  setPageLocation,
  trackPageView,
} from '@/lib/analytics';
import { detectCapabilities } from '@/lib/client-capabilities';

const VITALS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;
type VitalName = (typeof VITALS)[number];

const CAPS_SENT_KEY = 'ga_caps_sent';

function firstPage(): string {
  try {
    const u = new URL(sanitizeLocation(window.location.href));
    return u.pathname + u.search;
  } catch {
    return '';
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const lastViewKey = useRef<string | null>(null);
  // CLS・INP は非表示時に確定し、そのとき別ページにいることがあるため、最初に描画したページを残す
  const vitalsPage = useRef<string | null>(null);
  if (vitalsPage.current === null && typeof window !== 'undefined') {
    vitalsPage.current = firstPage();
  }

  useEffect(() => {
    loadGtag();
    try {
      if (sessionStorage.getItem(CAPS_SENT_KEY)) return;
      sessionStorage.setItem(CAPS_SENT_KEY, '1');
    } catch {
      // 保存領域が使えない端末は読み込みごとに送る
    }
    sendGaEvent('client_capabilities', detectCapabilities());
  }, []);

  useEffect(() => {
    if (lastViewKey.current !== pathname) {
      lastViewKey.current = pathname;
      trackPageView();
    } else {
      setPageLocation();
    }
  }, [pathname, query]);

  // 参照が変わるたび web-vitals が再登録され buffered 分が二重送信されるため、参照を固定する
  const reportVital = useCallback(
    (m: { name: string; value: number; rating?: string }) => {
      if (!(VITALS as readonly string[]).includes(m.name)) return;
      sendGaEvent('web_vitals', {
        metric_name: m.name as VitalName,
        metric_value: m.value,
        metric_rating: (m.rating ?? 'good') as
          'good' | 'needs-improvement' | 'poor',
        vitals_page: vitalsPage.current ?? '',
      });
    },
    [],
  );
  useReportWebVitals(reportVital);

  return null;
}
