import type { Media } from '@/cms-types';
import type { Attachment } from './home-page-types';

export type MediaRef = number | string | Media | null | undefined;

/** depth 指定時でも参照が ID のまま返ることがあるため、両方の形を受ける。 */
export function toMediaId(media: MediaRef): string | null {
  if (media === null || media === undefined) return null;
  if (typeof media === 'object') return String(media.id);
  return String(media);
}

export function toAttachment(media: MediaRef): Attachment | null {
  const id = toMediaId(media);
  if (id === null) return null;
  if (media === null || media === undefined || typeof media !== 'object') {
    return { id, filenameDownload: '', type: null };
  }
  return {
    id,
    filenameDownload: media.filename ?? '',
    type: media.mimeType ?? null,
  };
}

/** Payload は配列順を保持するため、並べ替えずそのまま使う。 */
export function toAttachments(list: readonly MediaRef[] | null | undefined): Attachment[] {
  return (list ?? [])
    .map(toAttachment)
    .filter((attachment): attachment is Attachment => attachment !== null);
}
