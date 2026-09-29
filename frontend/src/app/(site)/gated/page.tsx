import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// generateMetadata 未定義のままだと (site) レイアウトのサイト既定メタデータ
// (robots: index,follow を含む) がそのまま出てしまう。notFound() を呼び、
// (site)/not-found.tsx 側のメタデータへフォールバックさせる
export function generateMetadata(): Metadata {
  notFound();
}

export default function GatedPage() {
  notFound();
}
