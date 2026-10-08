import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { SignageScreen } from '@/components/signage/signage-screen';
import { getSignageSnapshot } from '@/lib/signage-data';

// 配信端末が常に最新を取り直すページで、ダミー CMS のビルドで事前描画させない
export const dynamic = 'force-dynamic';

// 日本語サブセットは巨大なため preload せず、字形の取得はブラウザに任せる
const notoSansJp = Noto_Sans_JP({
  weight: ['400', '700'],
  variable: '--font-noto-sans-jp',
  preload: false,
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'サイネージ',
  robots: { index: false, follow: false },
};

export default async function SignagePage() {
  const result = await getSignageSnapshot();

  return (
    <div className={notoSansJp.variable}>
      <SignageScreen
        initial={result.ok ? result.value : null}
        renderedAt={new Date().toISOString()}
      />
    </div>
  );
}
