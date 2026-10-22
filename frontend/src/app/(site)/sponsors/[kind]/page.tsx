import { notFound } from 'next/navigation';

// 協賛ページは未実装。静的な sponsors/ad 等ができればそちらが優先される。
export default function SponsorsPage() {
  notFound();
}
