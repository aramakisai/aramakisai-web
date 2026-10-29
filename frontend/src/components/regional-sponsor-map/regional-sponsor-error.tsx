'use client';

export function RegionalSponsorError({
  onRetry,
  className = '',
}: {
  readonly onRetry?: () => void;
  readonly className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-warning bg-orange-50 p-4 ${className}`}
      role="alert"
    >
      <p className="text-sm leading-6 text-text">
        地域協賛情報を取得できませんでした。
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        再試行
      </button>
    </div>
  );
}
