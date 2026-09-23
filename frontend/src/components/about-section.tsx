import { RichText } from './rich-text';
import { SectionHeading } from './section-heading';

export interface AboutSectionProps {
  readonly overviewHtml: string | null;
}

// 開催前・開催中どちらのトップページからも同じ部品・同じ内容で使う (design.md Requirement 1/3)。
// ヘッダー/フッターの「荒牧祭について」リンクが `/#about` でこの id を参照する。
export function AboutSection({ overviewHtml }: AboutSectionProps) {
  return (
    <section
      id="about"
      className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-8 lg:px-20 lg:py-12"
    >
      <SectionHeading level="h2">荒牧祭とは</SectionHeading>
      {overviewHtml && (
        <RichText
          html={overviewHtml}
          className="max-w-3xl text-base leading-[1.7] text-text"
        />
      )}
    </section>
  );
}
