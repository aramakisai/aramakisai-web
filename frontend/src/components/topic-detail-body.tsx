/* eslint-disable @next/next/no-img-element -- 実ファイルは配信時に解決するため next/image の最適化対象にできない */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { TopicSummary } from '@/lib/home-page-types';
import { RichText } from '@/components/rich-text';
import { RichTextImageViewer } from '@/components/rich-text-image-viewer';

export interface TopicDetailBodyProps {
  readonly topic: Pick<TopicSummary, 'title' | 'body' | 'imageId'>;
  readonly variant?: 'site' | 'signage';
}

export function TopicDetailBody({
  topic,
  variant = 'site',
}: TopicDetailBodyProps) {
  const signage = variant === 'signage';
  const thumbnailUrl = toAssetUrl(topic.imageId);

  const content = (
    <>
      <h1
        className={
          signage
            ? 'w-full py-0 text-center text-signage-title leading-[40px] tracking-[0.02em] text-text'
            : 'w-full text-balance py-0 text-center text-[28px] leading-[130%] text-text lg:text-[32px] lg:leading-[125%]'
        }
      >
        {topic.title}
      </h1>

      <RichTextImageViewer>
        <div
          className={`flex w-full flex-col ${signage ? 'gap-8' : 'gap-6 lg:gap-8'}`}
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={topic.title}
              data-media-id={topic.imageId}
              className={`block h-auto w-full rounded-xl object-contain ${signage ? 'max-h-[512px]' : 'max-h-[358px] lg:max-h-[768px]'}`}
            />
          )}

          {topic.body && <RichText html={topic.body} variant={variant} />}
        </div>
      </RichTextImageViewer>
    </>
  );

  if (!signage) return content;
  return <div className="mx-auto flex w-[768px] flex-col gap-8">{content}</div>;
}
