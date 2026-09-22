import Link from 'next/link';
import { ChevronRightIcon } from './icons';

export interface AccessSectionProps {
  readonly venueName: string | null;
  readonly accessSummary: string | null;
}

export function AccessSection({
  venueName,
  accessSummary,
}: AccessSectionProps) {
  // 空白のみの入力も未設定として扱う (要件 3.11)
  const venue = venueName?.trim() || null;
  const summary = accessSummary?.trim() || null;

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-8 lg:gap-6 lg:px-20 lg:py-12">
      <h2 className="py-0">アクセス</h2>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex h-[200px] w-full shrink-0 items-center justify-center bg-gray-200 lg:h-[320px] lg:w-[720px]">
          <span className="text-sm text-gray-500">地図 (placeholder)</span>
        </div>
        {(venue || summary) && (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {venue && (
              <p
                data-testid="access-venue-name"
                className="text-base leading-[170%] text-text"
              >
                会場：{venue}
              </p>
            )}
            {summary && (
              <p
                data-testid="access-summary"
                className="text-sm leading-[160%] whitespace-pre-wrap text-text"
              >
                {summary}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Link
          href="/access"
          className="flex items-center gap-2 text-sm font-bold text-primary"
        >
          アクセス詳細へ
          <ChevronRightIcon size={20} className="text-text" />
        </Link>
      </div>
    </section>
  );
}
