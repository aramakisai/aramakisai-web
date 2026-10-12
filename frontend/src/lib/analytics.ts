import { env } from '@/env';
import type { StampCategory } from './stamp-signature';

export interface QrStampParams {
  readonly exhibition_id: number;
  readonly exhibition_category: StampCategory;
}

export function sendGaEvent(name: 'qr_stamp', params: QrStampParams): void {
  if (
    process.env.NODE_ENV !== 'production' ||
    !env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  ) {
    return;
  }
  const w = window as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  // gtag.js は Arguments オブジェクトの dataLayer 要素だけをコマンドとして解釈する
  // (通常の配列だと無視される) ため、gtag() と同じく arguments を積む
  /* eslint-disable prefer-rest-params */
  function gtag() {
    w.dataLayer!.push(arguments);
  }
  /* eslint-enable prefer-rest-params */
  (gtag as (...args: unknown[]) => void)('event', name, params);
}
