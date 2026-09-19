import type { Metadata } from 'next';
import { Zen_Old_Mincho } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';
import { getFestivalMeta } from '@/lib/festival-meta';
import { env } from '@/env';

const zenOldMincho = Zen_Old_Mincho({
  weight: '700',
  subsets: ['latin'],
  variable: '--font-zen-old-mincho',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  let name = '';
  try {
    ({ name } = await getFestivalMeta());
  } catch {
    name = '';
  }
  const titleBase = name || '荒牧祭';
  const siteTitle =
    process.env.NODE_ENV === 'development'
      ? `【開発環境】 ${titleBase}`
      : titleBase;

  return {
    // 相対 URL のメタデータ (og:url 等) を解決するため。toAssetUrl は絶対 URL を返すのでここでは解決されない。
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description: '荒牧祭公式サイト',
    icons: {
      icon: '/images/favicon.png',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="ja" className={zenOldMincho.variable}>
      <body className="flex min-h-screen min-h-dvh min-w-0 flex-col font-sans">
        {children}
      </body>
      {process.env.NODE_ENV === 'production' && gaMeasurementId && (
        <GoogleAnalytics gaId={gaMeasurementId} />
      )}
    </html>
  );
}
