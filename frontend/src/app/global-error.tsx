'use client';

import './globals.css';

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center font-sans">
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">エラーが発生しました</h1>
          <p className="text-gray-600">
            アプリケーションで問題が発生しました。時間をおいて再度お試しください。
          </p>
          <button
            onClick={reset}
            className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
          >
            再読み込み
          </button>
        </main>
      </body>
    </html>
  );
}
