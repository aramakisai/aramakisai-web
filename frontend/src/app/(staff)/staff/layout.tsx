import type { Metadata } from 'next';
import { DetailColumn } from '@/components/detail-column';

export const metadata: Metadata = {
  title: '管理者画面',
  robots: { index: false, follow: false },
};

// 認可はここでは行わない。レイアウトはナビゲーション時に再描画されないため、各 page.tsx が行う
export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex-1 bg-background">
      <DetailColumn>{children}</DetailColumn>
    </div>
  );
}
