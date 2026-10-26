import { TextLink } from './text-link';
import { SandboxedEmbed } from './sandboxed-embed';
import { SectionHeading } from './section-heading';
import { ACCESS_SUMMARY, CAMPUS_MAP_EMBED_URL, VENUE_NAME } from '@/lib/venue';

export function AccessSection() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 lg:px-20 lg:py-12">
      <SectionHeading level="h2">アクセス</SectionHeading>
      <div className="flex flex-col gap-4 lg:gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex h-[200px] w-full shrink-0 items-center justify-center bg-gray-200 lg:h-[320px] lg:w-[720px]">
            <SandboxedEmbed
              url={CAMPUS_MAP_EMBED_URL}
              title="会場周辺の地図"
              className="h-full w-full border-0"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p
              data-testid="access-venue-name"
              className="text-base leading-[170%] text-text"
            >
              会場：{VENUE_NAME}
            </p>
            <p
              data-testid="access-summary"
              className="text-sm leading-[160%] whitespace-pre-wrap text-text"
            >
              {ACCESS_SUMMARY}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <TextLink href="/access">アクセス詳細へ</TextLink>
        </div>
      </div>
    </section>
  );
}
