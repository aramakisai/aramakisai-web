import { cookies } from 'next/headers';
import { Header, MAIN_CONTENT_ID } from '@/components/header';
import { Footer } from '@/components/footer';
import { BottomNavigation } from '@/components/bottom-navigation';
import {
  BackgroundShapes,
  PAGE_CONTAINER_ID,
} from '@/components/background-shapes';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const { phase } = resolvePhase(cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value);

  return (
    // 背景の図形装飾 (BackgroundShapes) を敷くための外側のコンテナ。
    // main の flex-1 (フッターを下端へ押し出す) を成立させるため flex 文脈を引き継ぐ。
    // relative は装飾レイヤー (absolute inset-0) の位置決め基準にするため必須
    <div
      id={PAGE_CONTAINER_ID}
      className="relative flex min-h-full min-w-0 flex-1 flex-col"
    >
      <Header phase={phase} />
      <BackgroundShapes />
      <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1">
        {children}
      </main>
      <Footer phase={phase} />
      {/* BottomNavigation は fixed で画面下端に重なるため、余白は main ではなく
          枠の最後 (Footer の後ろ) に置かないと Footer の下端が隠れる。
          表示条件は BottomNavigation 自身と揃える (開催中フェーズかつ 1024px 未満) */}
      {phase === 'live' && (
        <div
          aria-hidden="true"
          className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden"
        />
      )}
      <BottomNavigation phase={phase} />
    </div>
  );
}
