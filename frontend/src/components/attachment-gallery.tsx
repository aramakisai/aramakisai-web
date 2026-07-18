/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { Attachment } from '../lib/home-page-types';
import { toAssetUrl } from '../lib/directus-asset-url';

export interface AttachmentGalleryProps {
  attachments: Attachment[];
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((attachment) => {
        const isImage = attachment.type?.startsWith('image/');
        const url = toAssetUrl(attachment.id);

        if (!url) return null;

        if (isImage) {
          return (
            <img
              key={attachment.id}
              src={url}
              alt={attachment.filenameDownload}
            />
          );
        }

        return (
          <a key={attachment.id} href={url} download>
            {attachment.filenameDownload}
          </a>
        );
      })}
    </div>
  );
}
