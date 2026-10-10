import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { toAssetUrl } from '@/lib/cms-asset-url';

export interface RichTextProps {
  html: string;
  className?: string;
}

export function RichText({ html, className }: RichTextProps) {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      'h2',
      'h3',
      'h4',
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'span',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'img',
      'hr',
      'div',
      'figure',
      'figcaption',
      'aside',
      'table',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'rel'],
      span: ['style'],
      img: ['src', 'alt', 'data-media-id'],
      div: ['data-count'],
      aside: ['data-kind'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedClasses: {
      div: ['rt-image-row', 'rt-table'],
      aside: ['rt-callout'],
      p: ['rt-button'],
    },
    allowedStyles: {
      span: {
        'text-decoration': [/^underline$/, /^line-through$/],
      },
    },
    transformTags: {
      // lexicalHTMLField は本文全体を <div class="payload-richtext"> で包む。div を残すと
      // `.rich-text-body > :first-child` 等の余白指定が本文の先頭・末尾に効かなくなるため、
      // 部品の div 以外は許可外のタグ名に変えて中身だけ残す
      div: (tagName, attribs) => ({
        tagName: /\brt-(image-row|table)\b/.test(attribs.class ?? '')
          ? 'div'
          : 'unwrap',
        attribs,
      }),
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
        },
      }),
      // CMS は実ファイル URL を焼き込まずメディア ID のみを渡す (rich-text-html-converters.ts) ため、ここで配信 URL を組み立てる
      img: (tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          src: toAssetUrl(attribs['data-media-id'] ?? null) ?? '',
          alt: attribs.alt ?? '',
          // 拡大表示で大きいサイズの URL を組み立て直すために残す (design.md)
          'data-media-id': attribs['data-media-id'] ?? '',
        },
      }),
    },
    // メディア ID を読み取れない画像は壊れた img を出さずタグごと落とす (要件 15.5)
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });

  return (
    <div
      className={[
        'rich-text-body min-w-0 break-words [overflow-wrap:anywhere]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
