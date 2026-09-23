import { Attachment } from '../lib/home-page-types';
import { toAssetUrl } from '../lib/cms-asset-url';
import { DraftIcon } from './icons';

export interface AttachmentGalleryProps {
  attachments: Attachment[];
}

function formatLabel({ filenameDownload, type }: Attachment): string {
  const extension = /\.([^./]+)$/.exec(filenameDownload)?.[1];
  if (extension) return extension.toUpperCase();
  const subtype = type?.split('/')[1];
  return subtype ? subtype.toUpperCase() : '';
}

function formatSize(filesize: number | null): string | null {
  if (filesize == null) return null;
  const mb = filesize / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(filesize / 1024)} KB`;
}

function formatMeta(attachment: Attachment): string {
  const format = formatLabel(attachment);
  const size = formatSize(attachment.filesize);
  return size ? `${format}・${size}` : format;
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col">
      {attachments.map((attachment) => {
        const url = toAssetUrl(attachment.id);
        if (!url) return null;

        return (
          <li key={attachment.id} className="border-b border-gray-200">
            {/* CMS のメディアは別オリジンから配信され、download 属性はブラウザに無視されるため付けない */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-start gap-4 py-3 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <DraftIcon size={24} className="shrink-0 text-gray-500" />
                <span className="min-w-0 flex-1 text-base leading-[1.7] break-words text-text [overflow-wrap:anywhere]">
                  {attachment.filenameDownload}
                </span>
              </span>
              <span className="shrink-0 text-sm leading-[1.6] whitespace-nowrap text-gray-500">
                {formatMeta(attachment)}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
