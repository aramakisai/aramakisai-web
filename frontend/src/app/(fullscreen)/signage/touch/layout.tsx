import type { Metadata } from 'next';
import { TouchLinkGuard } from '@/components/signage/touch/touch-link-guard';
import { TouchLocationReporter } from '@/components/signage/touch/touch-location-reporter';

export const metadata: Metadata = {
  title: 'サイネージ',
  robots: { index: false, follow: false },
};

export default function TouchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TouchLinkGuard />
      <TouchLocationReporter />
      {/* 操作は fixed で右端に置くため、スクロールバーの出入りで 15px ずれて幅も変わり、内側のスクロール領域ではカードも縮む。タッチ操作なので全要素で出さない。layout の外では効かせない */}
      <style>{'*{scrollbar-width:none}*::-webkit-scrollbar{display:none}'}</style>
      <div className="min-h-dvh bg-background">{children}</div>
    </>
  );
}
