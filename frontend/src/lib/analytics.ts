import { env } from '@/env';
import type { CapabilityFlags } from './client-capabilities';
import type { ExhibitionCategory } from './exhibitions';

export interface ExhibitionEventParams {
  readonly exhibition_id: number;
  readonly exhibition_category: ExhibitionCategory;
}

type GaResult<T extends string> = { readonly result: T };

// イベント名に click は使わない (GA4 プロパティの page_view 由来のイベント作成ルールと衝突する)
export interface GaEventMap {
  qr_stamp: ExhibitionEventParams &
    GaResult<
      | 'added'
      | 'exists'
      | 'unavailable'
      | 'invalid'
      | 'failed'
      | 'network_error'
    >;
  bookmark_add: ExhibitionEventParams;
  bookmark_remove: ExhibitionEventParams;
  share:
    | {
        readonly method: 'web_share';
        readonly result: 'success' | 'cancel' | 'fail';
      }
    | { readonly method: 'clipboard'; readonly result: 'success' }
    | { readonly method: 'manual'; readonly result: 'fail' };
  campus_map:
    | {
        readonly result: 'ready';
        readonly method: 'hard' | 'soft';
        readonly duration_ms?: number;
      }
    | { readonly result: 'tile_error'; readonly item_count: number }
    | { readonly result: 'area_select' }
    | { readonly result: 'filter'; readonly item_count: number };
  user_location:
    | GaResult<
        | 'start'
        | 'out_of_campus'
        | 'denied'
        | 'unavailable'
        | 'timeout'
        | 'unsupported'
      >
    | {
        readonly result: 'located';
        readonly accuracy_bucket: 'lt20' | '20to50' | '50to100' | 'ge100';
        readonly duration_ms: number;
      };
  exhibition_search: { readonly item_count: number };
  location_map: GaResult<'fallback' | 'recenter'>;
  parking:
    | GaResult<'initial_missing' | 'poll_fail'>
    | { readonly result: 'stale'; readonly item_count: number };
  timetable: GaResult<'date_corrected'>;
  motion: GaResult<'reduce' | 'full'>;
  image_viewer: GaResult<'open'>;
  error_page:
    | {
        readonly result: 'error' | 'global_error';
        readonly error_digest?: string;
      }
    | GaResult<'not_found' | 'retry_success' | 'retry_fail'>;
  web_vitals: {
    readonly metric_name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
    readonly metric_value: number;
    readonly metric_rating: 'good' | 'needs-improvement' | 'poor';
    readonly vitals_page: string;
  };
  client_capabilities: CapabilityFlags;
}

type GaEventName = keyof GaEventMap;

type DataLayerWindow = Window & { dataLayer?: unknown[] };

let initialized = false;
let gtagRequested = false;

export function isGaEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    !!env.NEXT_PUBLIC_GA_MEASUREMENT_ID &&
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/signage') &&
    // 照会画面の URL に匿名IDと署名が入るため
    !window.location.pathname.startsWith('/staff')
  );
}

// q は検索キーワード。ハッシュにはスタンプの検証値が入るため両方送らない
export function sanitizeLocation(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('q');
  return url.origin + url.pathname + url.search;
}

function push(...args: unknown[]): void {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  // gtag.js は Arguments オブジェクトの dataLayer 要素だけをコマンドとして解釈する
  // (通常の配列だと無視される) ため、gtag() と同じく arguments を積む
  /* eslint-disable prefer-rest-params */
  function gtag() {
    w.dataLayer!.push(arguments);
  }
  (gtag as (...a: unknown[]) => void)(...args);
  /* eslint-enable prefer-rest-params */
}

function currentLocation(): string {
  return sanitizeLocation(window.location.href);
}

// 子の effect は親より先に走るため、どの送信が最初でも gtag.js 読み込み前に初期化を積む
function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  push('js', new Date());
  push('set', { page_location: currentLocation() });
  push('config', env.NEXT_PUBLIC_GA_MEASUREMENT_ID, { send_page_view: false });
}

export function sendGaEvent<K extends GaEventName>(
  name: K,
  params: GaEventMap[K],
): void {
  try {
    if (!isGaEnabled()) return;
    ensureInit();
    push('event', name, { ...params, page_location: currentLocation() });
  } catch {
    // 計測の失敗で画面を壊さない
  }
}

export function setPageLocation(): void {
  try {
    if (!isGaEnabled()) return;
    ensureInit();
    push('set', { page_location: currentLocation() });
  } catch {
    // 同上
  }
}

export function trackPageView(): void {
  try {
    if (!isGaEnabled()) return;
    setPageLocation();
    push('event', 'page_view');
  } catch {
    // 同上
  }
}

export function loadGtag(): void {
  try {
    if (!isGaEnabled() || gtagRequested) return;
    gtagRequested = true;
    const append = () => {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`;
      document.head.appendChild(s);
    };
    const idle = () =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(append)
        : setTimeout(append, 1);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  } catch {
    // 同上
  }
}
