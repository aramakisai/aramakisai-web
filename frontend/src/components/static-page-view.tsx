import React from 'react';
import { RichText } from './rich-text';
import { RichTextImageViewer } from './rich-text-image-viewer';
import { SandboxedEmbed } from './sandboxed-embed';

export interface StaticPageViewProps {
  title: string;
  contentHtml: string;
  embedUrl: string | null;
  embedTitle: string;
  embedHeight?: number | null;
}

export function StaticPageView({
  title,
  contentHtml,
  embedUrl,
  embedTitle,
  embedHeight = null,
}: StaticPageViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-bold">{title}</h1>
      <RichTextImageViewer>
        <RichText html={contentHtml} />
      </RichTextImageViewer>
      <SandboxedEmbed
        url={embedUrl}
        title={embedTitle}
        className={embedHeight ? 'w-full' : 'w-full aspect-video'}
        style={embedHeight ? { height: `${embedHeight}px` } : undefined}
      />
    </div>
  );
}
