/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { Attachment } from '../lib/home-page-types';
import { toAssetUrl } from '../lib/directus-asset-url';
import { RichText } from './rich-text';
import { AttachmentGallery } from './attachment-gallery';

export interface TopicCardProps {
  id: number;
  title: string;
  body: string | null;
  imageId: string | null;
  linkUrl: string | null;
  attachments: Attachment[];
}

export function TopicCard({
  id,
  title,
  body,
  imageId,
  linkUrl,
  attachments,
}: TopicCardProps) {
  const firstImageAttachment = attachments.find((a) =>
    a.type?.startsWith('image/'),
  );

  let thumbnailUrl = '/images/no-image.svg';
  if (firstImageAttachment) {
    thumbnailUrl = toAssetUrl(firstImageAttachment.id) || thumbnailUrl;
  } else if (imageId) {
    thumbnailUrl = toAssetUrl(imageId) || thumbnailUrl;
  }

  const topicUrl = `/topics/${id}`;

  return (
    <article className="border p-4 rounded flex flex-col gap-2">
      <Link href={topicUrl}>
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-auto object-cover rounded"
        />
      </Link>
      <h3 className="text-xl font-bold">
        <Link href={topicUrl} className="hover:underline">
          {title}
        </Link>
      </h3>
      {body && <RichText html={body} />}
      <AttachmentGallery attachments={attachments} />
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          詳細を見る
        </a>
      )}
    </article>
  );
}
