import { notFound } from 'next/navigation';

export default function TestPamphletPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main>
      <h1>プレビュー用テストパンフレット</h1>
      <p>これはリンク動作の確認用です。</p>
    </main>
  );
}
