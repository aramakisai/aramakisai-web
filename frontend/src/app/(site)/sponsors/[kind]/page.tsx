import { notFound } from 'next/navigation';

// ad 以外の未実装の協賛ページは準備中。静的なルートが優先される。
export default function SponsorsPage() {
  notFound();
}
