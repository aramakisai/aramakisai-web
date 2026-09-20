import type { Metadata } from 'next';
import { Zen_Old_Mincho } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import { cookies } from 'next/headers';
import './globals.css';
import { getFestivalMeta } from '@/lib/festival-meta';
import { DEV_OVERRIDE_ENABLED, PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';
import { PhaseToggle } from '@/components/phase-toggle';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaMeasurementId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // DEV_OVERRIDE_ENABLED はビルド時に真偽リテラルへ畳み込まれる。この分岐に
  // 閉じ込めることで、偽のビルドでは Cookie を読む経路自体がバンドラの
  // dead code elimination で成果物から消える。
  let phaseToggle: React.ReactNode = null;
  if (DEV_OVERRIDE_ENABLED) {
    const cookieStore = await cookies();
    const resolved = resolvePhase(
      cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value,
    );
    phaseToggle = <PhaseToggle resolved={resolved} />;
  }

  return (
    <html lang="ja" className={zenOldMincho.variable}>
      <body className="flex min-h-screen min-h-dvh min-w-0 flex-col font-sans">
        {children}
        {phaseToggle}
      </body>
      {process.env.NODE_ENV === 'production' && gaMeasurementId && (
        <GoogleAnalytics gaId={gaMeasurementId} />
      )}
    </html>
  );
}
