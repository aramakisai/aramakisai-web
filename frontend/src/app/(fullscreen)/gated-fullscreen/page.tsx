import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// (fullscreen) 配下に not-found.tsx が無いためルートの not-found.tsx まで
// フォールバックする。generateMetadata 側でも notFound() を呼ばないと
// サイト既定メタデータ (robots: index,follow を含む) のまま出てしまう
export function generateMetadata(): Metadata {
  notFound();
}

export default function GatedFullscreenPage() {
  notFound();
}
