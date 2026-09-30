import { RichText } from './rich-text';
import { SectionHeading } from './section-heading';

export interface ThemeSectionProps {
  readonly themeWord: string | null;
  readonly descriptionHtml: string | null;
}

// 趣旨文が未入稿の間は見出しだけの空セクションを出さないため、セクションごと描画しない。
export function ThemeSection({
  themeWord,
  descriptionHtml,
}: ThemeSectionProps) {
  if (!descriptionHtml) return null;

  return (
    <section
      id="theme"
      className="mx-auto w-full max-w-[1440px] scroll-mt-24 px-4 py-8 lg:px-20 lg:py-12"
    >
      <SectionHeading level="h2">
        {themeWord ? `テーマ「${themeWord}」` : 'テーマ'}
      </SectionHeading>
      <RichText
        html={descriptionHtml}
        className="max-w-3xl text-base leading-[1.7] text-text"
      />
    </section>
  );
}
