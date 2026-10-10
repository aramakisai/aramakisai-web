import type { Metadata } from 'next';
import { SignageScreen } from '@/components/signage/signage-screen';
import { getSignageSnapshot } from '@/lib/signage-data';

// 配信端末が常に最新を取り直すページで、ダミー CMS のビルドで事前描画させない
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'サイネージ',
  robots: { index: false, follow: false },
};

export default async function SignagePage() {
  const result = await getSignageSnapshot();

  return (
    <SignageScreen
      initial={result.ok ? result.value : null}
      renderedAt={new Date().toISOString()}
    />
  );
}
