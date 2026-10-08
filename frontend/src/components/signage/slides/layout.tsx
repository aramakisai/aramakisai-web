import { RichText } from '@/components/rich-text';

export type SlideLayout = 'title' | 'title-content' | 'section' | 'two-content';
export type SlideTone = 'normal' | 'alert';

export interface LayoutSlideProps {
  layout: SlideLayout;
  tone: SlideTone;
  title: string;
  subtext: string | null;
  content1Html: string;
  content2Html: string;
}

// 本文枠はサイネージ用スタイルで描き、はみ出しは枠の overflow で切る
function ContentFrame({ html, half }: { html: string; half: boolean }) {
  return (
    <div className="h-full min-w-0 flex-1 overflow-hidden">
      <RichText
        html={html}
        className={`rich-text-body--signage${half ? ' rich-text-body--half' : ''}`}
      />
    </div>
  );
}

export function LayoutSlide({
  layout,
  tone,
  title,
  subtext,
  content1Html,
  content2Html,
}: LayoutSlideProps) {
  const bg = tone === 'alert' ? 'bg-warning' : 'bg-white';
  const text = '[word-break:auto-phrase] overflow-hidden text-text';
  let body: React.ReactNode;

  if (layout === 'title') {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <p
          className={`line-clamp-2 w-full text-[96px] leading-[1.1] font-extrabold ${text}`}
        >
          {title}
        </p>
        {subtext && (
          <p
            className={`line-clamp-2 w-full text-[40px] leading-[1.3] font-bold ${text}`}
          >
            {subtext}
          </p>
        )}
      </div>
    );
  } else if (layout === 'section') {
    body = (
      <div className="flex flex-1 flex-col gap-6 pt-[282px]">
        <p
          className={`line-clamp-2 w-full text-[96px] leading-[1.1] font-extrabold ${text}`}
        >
          {title}
        </p>
        {subtext && (
          <p
            className={`line-clamp-3 w-full text-[36px] leading-[1.4] font-bold ${text}`}
          >
            {subtext}
          </p>
        )}
      </div>
    );
  } else {
    const two = layout === 'two-content';
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <p
          className={`line-clamp-1 w-full text-[64px] leading-[1.2] font-extrabold ${text}`}
        >
          {title}
        </p>
        <div className="flex min-h-0 flex-1 gap-12">
          <ContentFrame html={content1Html} half={two} />
          {two && <ContentFrame html={content2Html} half />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[864px] w-[1536px] flex-col overflow-hidden rounded-2xl p-16 ${bg}`}
    >
      {body}
    </div>
  );
}
