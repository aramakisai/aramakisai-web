'use client';

import { ErrorPageContent } from '@/components/error-page-content';
import { FALLBACK_SITE_TITLE } from '@/lib/site-metadata';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <meta name="robots" content="noindex" />
      <ErrorPageContent
        variant="error"
        pageTitle={`エラーが発生しました | ${FALLBACK_SITE_TITLE}`}
        onRetry={retry}
        digest={error.digest}
      />
    </div>
  );
}
