import { getNavigation } from '@/lib/get-navigation';
import { MAIN_CONTENT_ID } from '@/components/header';
import { Footer } from '@/components/footer';
import {
  PhasedBottomNavigation,
  PhasedBottomSpacer,
  PhasedHeader,
} from '@/components/phased-chrome';
import {
  BackgroundShapes,
  PAGE_CONTAINER_ID,
} from '@/components/background-shapes';

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = await getNavigation();
  return (
    // 背景の図形装飾 (BackgroundShapes) を敷くための外側のコンテナ。
    // main の flex-1 (フッターを下端へ押し出す) を成立させるため flex 文脈を引き継ぐ。
    // relative は装飾レイヤー (absolute inset-0) の位置決め基準にするため必須
    <div
      id={PAGE_CONTAINER_ID}
      className="relative flex min-h-full min-w-0 flex-1 flex-col"
    >
      <PhasedHeader navigation={navigation} />
      <BackgroundShapes />
      <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1">
        {children}
      </main>
      <Footer />
      <PhasedBottomSpacer />
      <PhasedBottomNavigation />
    </div>
  );
}
