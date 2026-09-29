'use client';

import './globals.css';
import { ErrorPageContent } from '@/components/error-page-content';
import { FALLBACK_SITE_TITLE } from '@/lib/site-metadata';

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center font-sans">
        <meta name="robots" content="noindex" />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <ErrorPageContent
            variant="error"
            pageTitle={`エラーが発生しました | ${FALLBACK_SITE_TITLE}`}
            onReset={reset}
          />
        </main>
      </body>
    </html>
  );
}
