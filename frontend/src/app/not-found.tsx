import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-gray-600">お探しのページが見つかりませんでした。</p>
      <Link href="/" className="text-blue-600 hover:underline">
        トップページに戻る
      </Link>
    </main>
  );
}
