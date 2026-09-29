import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEV_OVERRIDE_ENABLED } from '@/lib/phase';

// (fullscreen)/error.tsx の E2E 検証専用ルート。ゲート判定は無い単純な直下ページのため、
// (site) 側と同じパスにはできない ((site)/(fullscreen) は同一 URL を共有できない)。
// 本番非到達の保証は (site)/e2e-error-trigger と同じ (DEV_OVERRIDE_ENABLED 参照)。
// generateMetadata でも同じ条件で notFound() を呼ばないと、本番の 404 なのに
// サイト既定メタデータ (robots: index,follow を含む) のまま出てしまう
export function generateMetadata(): Metadata {
  if (!DEV_OVERRIDE_ENABLED) {
    notFound();
  }
  return {};
}

export default function E2EErrorTriggerFullscreenPage() {
  if (!DEV_OVERRIDE_ENABLED) {
    notFound();
  }
  throw new Error(
    'e2e-error-trigger-fullscreen: (fullscreen)/error.tsx のE2E検証用の意図的な例外',
  );
}
