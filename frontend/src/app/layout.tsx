import type { Metadata } from 'next';
import { Zen_Old_Mincho } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';
import { cookies } from 'next/headers';
import './globals.css';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import {
  DEV_OVERRIDE_ENABLED,
  PHASE_OVERRIDE_COOKIE,
  resolvePhase,
} from '@/lib/phase';
import { PhaseToggle } from '@/components/phase-toggle';
import { env } from '@/env';

const zenOldMincho = Zen_Old_Mincho({
  weight: '700',
  subsets: ['latin'],
  variable: '--font-zen-old-mincho',
  display: 'swap',
});

// Material Symbols は next/font/google の対象フォント一覧に無く (アイコン名によるサブセット
// 指定 (icon_names) を next/font がサポートしないため)、通常の <link> で読み込む。
// weight/FILL は固定値のみ使うため wght は 300 で固定し、FILL だけ 0..1 の範囲を残して
// アイコンごとに塗りつぶし版 (位置ピン) と線画版を出し分ける
const MATERIAL_SYMBOLS_ICON_NAMES = [
  'arrow_back',
  'calendar_clock',
  'chevron_left',
  'chevron_right',
  'close',
  'draft',
  'expand_more',
  'festival',
  'hide_image',
  'home',
  'image',
  'link',
  'location_on',
  'mail',
  'map',
  'menu',
  'open_in_new',
  'parking_sign',
  'pause',
  'play_arrow',
  'search',
  'share',
].join(',');
const MATERIAL_SYMBOLS_HREF = `https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@24,300,0..1,0&icon_names=${MATERIAL_SYMBOLS_ICON_NAMES}&display=block`;

// hydration 前に停止指定を <html> へ反映しないと、初回描画がちらつく
// (自動送り等が一瞬動いてから止まる)。lib/use-motion-preference.ts の
// MOTION_STORAGE_KEY / 判定 (OS 設定と保存値の OR) を resolveReduced と一致させること
const MOTION_INIT_SCRIPT = `
try {
  var m;
  try { m = localStorage.getItem('aramakisai_motion'); } catch (e) { m = null; }
  var reduced = m === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.setAttribute('data-motion', 'reduce');
} catch (e) {}
`;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();

  return {
    // 相対 URL のメタデータ (og:url 等) を解決するため。toAssetUrl は絶対 URL を返すのでここでは解決されない。
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    icons: {
      icon: '/images/favicon.png',
    },
    ...buildPageMetadata({
      site,
      title: null,
      description: null,
      path: null,
      ogType: 'website',
      imageCandidates: [],
    }),
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
    <html lang="ja" className={zenOldMincho.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
        <script dangerouslySetInnerHTML={{ __html: MOTION_INIT_SCRIPT }} />
      </head>
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
