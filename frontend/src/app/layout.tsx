import type { Metadata } from 'next';
import { Zen_Old_Mincho } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getFestivalMeta } from '@/lib/festival-meta';
import { env } from '@/env';

const zenOldMincho = Zen_Old_Mincho({
  weight: '900',
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
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
      {process.env.NODE_ENV === 'production' && gaMeasurementId && (
        <GoogleAnalytics gaId={gaMeasurementId} />
      )}
    </html>
  );
}
