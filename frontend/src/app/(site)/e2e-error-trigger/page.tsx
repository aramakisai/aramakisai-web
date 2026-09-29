import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEV_OVERRIDE_ENABLED } from '@/lib/phase';

// error.tsx の E2E 検証専用ルート。DEV_OVERRIDE_ENABLED は frontend-ci.yml の
// deploy-prod では常に偽になる (NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE を付与しない) ため、
// 本番ビルドでは notFound() のみが残り例外は発生しない。
// generateMetadata でも同じ条件で notFound() を呼ばないと、本番の 404 なのに
// サイト既定メタデータ (robots: index,follow を含む) のまま出てしまう
export function generateMetadata(): Metadata {
  if (!DEV_OVERRIDE_ENABLED) {
    notFound();
  }
  return {};
}

export default function E2EErrorTriggerPage() {
  if (!DEV_OVERRIDE_ENABLED) {
    notFound();
  }
  throw new Error(
    'e2e-error-trigger: (site)/error.tsx のE2E検証用の意図的な例外',
  );
}
