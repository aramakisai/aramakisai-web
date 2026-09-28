'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export type ErrorPageContentProps =
  | { variant: 'not-found'; pageTitle: string }
  | { variant: 'error'; pageTitle: string; onReset: () => void };

/**
 * root layout の generateMetadata (サイト既定タイトル) は CMS への非同期フェッチを
 * 経て解決し、その解決タイミングで <title> を無条件に上書きする。この上書きは
 * notFound()/エラー境界側の <title> (Metadata API 由来・JSX 直書き問わず) より
 * 後に発生し得るため、一度 pageTitle を書いても再び既定タイトルへ戻る。
 * MutationObserver でこのページが表示され続ける間ずっと補正し続けることで、
 * その上書きタイミングに依存せず固有タイトルを維持する (要件 2.1-2.3)。
 */
function useStablePageTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = pageTitle;

    // React の hoistable <title> reconciliation は既存の要素を書き換えず、
    // 差し替え (旧要素を削除し新要素を挿入) で行われることがある。特定の
    // <title> 要素だけを監視すると差し替え後に検知できなくなるため、
    // head 全体の childList を見て毎回 document.title で判定する。
    const observer = new MutationObserver(() => {
      if (document.title !== pageTitle) document.title = pageTitle;
    });
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [pageTitle]);
}

export function ErrorPageContent(props: ErrorPageContentProps) {
  useStablePageTitle(props.pageTitle);

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
