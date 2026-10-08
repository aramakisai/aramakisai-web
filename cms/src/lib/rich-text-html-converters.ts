import type {
  HTMLConverterAsync,
  HTMLConvertersFunctionAsync,
} from '@payloadcms/richtext-lexical/html-async';
import type { SerializedUploadNode } from '@payloadcms/richtext-lexical';

import { validateButtonUrl } from '../blocks/rich-text-blocks';

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

type Populate = (args: { collectionSlug: string; id: number | string }) => Promise<unknown>;

const resolveImage = async (value: unknown, populate: Populate | undefined): Promise<MediaDoc | undefined> => {
  const doc = (
    typeof value === 'object' && value !== null
      ? value
      : value !== undefined && value !== null && populate
        ? await populate({ id: value as number | string, collectionSlug: 'media' })
        : undefined
  ) as MediaDoc | undefined;
  return doc?.mimeType?.startsWith('image') && doc.id !== undefined && doc.id !== null ? doc : undefined;
};

type BlockArgs = { node: { fields: Record<string, unknown> }; populate?: Populate };

const imageRowConverter = async ({ node, populate }: BlockArgs): Promise<string> => {
  const items = (node.fields.items as { image?: unknown; label?: null | string }[] | undefined) ?? [];
  const figures: string[] = [];
  for (const item of items) {
    const image = await resolveImage(item.image, populate);
    if (!image) continue;
    const label = escapeAttr(item.label ?? '');
    figures.push(
      `<figure>${label ? `<figcaption>${label}</figcaption>` : ''}<img data-media-id="${escapeAttr(String(image.id))}" alt="${label}"></figure>`,
    );
  }
  return figures.length ? `<div class="rt-image-row" data-count="${figures.length}">${figures.join('')}</div>` : '';
};

const calloutConverter = ({ node }: BlockArgs): string => {
  const kind = node.fields.kind === 'note' ? 'note' : 'caution';
  const text = escapeAttr(String(node.fields.text ?? '')).replace(/\r?\n/g, '<br>');
  return `<aside class="rt-callout" data-kind="${kind}"><p>${text}</p></aside>`;
};

// 管理画面の検証をすり抜けた保存値 (API 直書き等) が javascript: などを出力しないよう、変換側でも判定する
const buttonLinkConverter = ({ node }: BlockArgs): string => {
  const url = String(node.fields.url ?? '');
  if (validateButtonUrl(url) !== true) return '';
  return `<p class="rt-button"><a href="${escapeAttr(url)}">${escapeAttr(String(node.fields.label ?? ''))}</a></p>`;
};

type TableCell = { colSpan?: number; headerState?: number; rowSpan?: number };

export const richTextHTMLConverters: HTMLConvertersFunctionAsync = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: uploadConverter(defaultConverters.upload as HTMLConverterAsync<SerializedUploadNode> | undefined),
  blocks: { imageRow: imageRowConverter, callout: calloutConverter, buttonLink: buttonLinkConverter } as never,
  // 既定の変換はインライン style と lexical 用 class を焼き込むため、サイト側の表スタイルが効くよう外す
  table: async ({ node, nodesToHTML }) =>
    `<div class="rt-table"><table><tbody>${(await nodesToHTML({ nodes: node.children })).join('')}</tbody></table></div>`,
  tablerow: async ({ node, nodesToHTML }) => `<tr>${(await nodesToHTML({ nodes: node.children })).join('')}</tr>`,
  tablecell: async ({ node, nodesToHTML }) => {
    const { colSpan, headerState, rowSpan } = node as unknown as TableCell;
    const tag = headerState && headerState > 0 ? 'th' : 'td';
    const span = `${colSpan && colSpan > 1 ? ` colspan="${colSpan}"` : ''}${rowSpan && rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''}`;
    return `<${tag}${span}>${(await nodesToHTML({ nodes: node.children })).join('')}</${tag}>`;
  },
});
