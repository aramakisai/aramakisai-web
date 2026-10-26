'use client';

import { BottomNavigation } from '@/components/bottom-navigation';
import { Header } from '@/components/header';
import type { NavigationByPhase } from '@/lib/navigation';
import { usePhase } from '@/lib/use-phase';

export function PhasedHeader({
  navigation,
}: {
  readonly navigation: NavigationByPhase;
}) {
  return <Header phase={usePhase().phase} navigation={navigation} />;
}

export function PhasedBottomNavigation() {
  return <BottomNavigation phase={usePhase().phase} />;
}

// BottomNavigation は fixed で画面下端に重なるため、開催中かつ 1024px 未満では
// 枠の最後に同じ高さの余白が要る (表示条件は BottomNavigation と揃える)
export function PhasedBottomSpacer() {
  if (usePhase().phase !== 'live') return null;
  return (
    <div
      aria-hidden="true"
      className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden"
    />
  );
}
