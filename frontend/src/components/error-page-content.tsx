'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { HoverLine } from './hover-line';
import { sendGaEvent } from '@/lib/analytics';

type ErrorProps = {
  variant: 'error';
  pageTitle: string;
  onRetry: () => void;
  digest?: string;
  scope?: 'segment' | 'global';
};

export type ErrorPageContentProps =
  { variant: 'not-found'; pageTitle: string } | ErrorProps;

// 再試行が失敗するとエラー画面は別インスタンスとして作り直されるため、refではなく
// モジュール変数で3画面共通に引き継ぐ
let pendingRetry = false;

export function ErrorPageContent(props: ErrorPageContentProps) {
  return props.variant === 'not-found' ? (
    <NotFoundContent pageTitle={props.pageTitle} />
  ) : (
    <ErrorContent {...props} />
  );
}

function NotFoundContent({ pageTitle }: { pageTitle: string }) {
  useEffect(() => {
    sendGaEvent('error_page', { result: 'not_found' });
  }, []);

  return (
    <div className="space-y-6 text-center">
      <title>{pageTitle}</title>
      <p className="text-warning text-6xl font-extrabold">404</p>
      <h1 className="text-3xl font-bold">ページが見つかりません</h1>
      <p className="text-gray-600">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link href="/" className="group relative inline-block text-text">
        トップページに戻る
        <HoverLine />
      </Link>
    </div>
  );
}

function ErrorContent({ pageTitle, onRetry, digest, scope }: ErrorProps) {
  useEffect(() => {
    if (pendingRetry) {
      // 再試行のたびにエラー表示件数が増えないよう、失敗側だけを送る
      pendingRetry = false;
      sendGaEvent('error_page', { result: 'retry_fail' });
    } else {
      sendGaEvent('error_page', {
        result: scope === 'global' ? 'global_error' : 'error',
        ...(digest ? { error_digest: digest } : {}),
      });
    }
    return () => {
      // 失敗時の作り直しは同じコミットで新インスタンスがマウントされ、
      // このタイマーが走る前にフラグが偽へ戻る
      setTimeout(() => {
        if (pendingRetry) {
          pendingRetry = false;
          sendGaEvent('error_page', { result: 'retry_success' });
        }
      }, 0);
    };
  }, [digest, scope]);

  return (
    <div className="space-y-6 text-center">
      <title>{pageTitle}</title>
      <h1 className="text-3xl font-bold">エラーが発生しました</h1>
      <p className="text-gray-600">
        ページの表示中に問題が発生しました。時間をおいて再度お試しください。
      </p>
      <button
        onClick={() => {
          pendingRetry = true;
          onRetry();
        }}
        className="hover-card-shadow rounded-lg border border-gray-200 px-4 py-2 hover:bg-background"
      >
        再読み込み
      </button>
    </div>
  );
}
