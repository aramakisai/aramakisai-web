'use client';

import Link from 'next/link';

export type ErrorPageContentProps =
  | { variant: 'not-found'; pageTitle: string }
  | { variant: 'error'; pageTitle: string; onReset: () => void };

export function ErrorPageContent(props: ErrorPageContentProps) {
  if (props.variant === 'not-found') {
    return (
      <div className="space-y-6 text-center">
        <title>{props.pageTitle}</title>
        <p className="text-warning text-6xl font-extrabold">404</p>
        <h1 className="text-3xl font-bold">ページが見つかりません</h1>
        <p className="text-gray-600">
          お探しのページは移動または削除された可能性があります。
        </p>
        <Link href="/" className="text-text hover:underline">
          トップページに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <title>{props.pageTitle}</title>
      <h1 className="text-3xl font-bold">エラーが発生しました</h1>
      <p className="text-gray-600">
        ページの表示中に問題が発生しました。時間をおいて再度お試しください。
      </p>
      <button
        onClick={props.onReset}
        className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
      >
        再読み込み
      </button>
    </div>
  );
}
