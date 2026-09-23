import type {
  HTMLConverterAsync,
  HTMLConvertersFunctionAsync,
} from '@payloadcms/richtext-lexical/html-async';
import type { SerializedUploadNode } from '@payloadcms/richtext-lexical';

type MediaDoc = { alt?: null | string; id: number | string; mimeType?: null | string };

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeAttr = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);

/**
 * 実ファイル URL を焼き込むと S3 の実体パスが HTML に固定され、フロントエンドの
 * toAssetUrl() 経由の配信 (サイズ違いの解決を /api/media/serve に一元化する方針) と衝突するため、
 * 画像だけ src の代わりにメディア ID を渡す。画像以外は defaultConverters のリンク変換に委ねる。
 */
const uploadConverter =
  (defaultUpload: HTMLConverterAsync<SerializedUploadNode> | undefined): HTMLConverterAsync<SerializedUploadNode> =>
  async (args) => {
    const { node, populate } = args;
    const uploadDoc = (
      typeof node.value === 'object'
        ? node.value
        : populate
          ? await populate({ id: node.value, collectionSlug: node.relationTo })
          : undefined
    ) as unknown as MediaDoc | undefined;

    if (!uploadDoc?.mimeType?.startsWith('image')) {
      return typeof defaultUpload === 'function' ? defaultUpload(args) : '';
    }

    // ID を確定できない画像は壊れた HTML を出さないよう描画しない
    if (uploadDoc.id === undefined || uploadDoc.id === null) return '';

    const alt = escapeAttr(String((node.fields as { alt?: unknown } | undefined)?.alt || uploadDoc.alt || ''));
    return `<img data-media-id="${escapeAttr(String(uploadDoc.id))}" alt="${alt}">`;
  };

export const richTextHTMLConverters: HTMLConvertersFunctionAsync = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: uploadConverter(defaultConverters.upload as HTMLConverterAsync<SerializedUploadNode> | undefined),
});
