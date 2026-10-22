'use client';

import { Suspense } from 'react';
import './globals.css';
import { GoogleAnalytics } from '@/components/google-analytics';
import { ErrorPageContent } from '@/components/error-page-content';
import { FALLBACK_SITE_TITLE } from '@/lib/site-metadata';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center font-sans">
        <meta name="robots" content="noindex" />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <ErrorPageContent
            variant="error"
            pageTitle={`エラーが発生しました | ${FALLBACK_SITE_TITLE}`}
            onRetry={retry}
            digest={error.digest}
            scope="global"
          />
        </main>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
      </body>
    </html>
  );
}
