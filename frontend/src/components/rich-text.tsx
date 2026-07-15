import React from 'react';
import sanitizeHtml from 'sanitize-html';

export interface RichTextProps {
  html: string;
  className?: string;
}

export function RichText({ html, className }: RichTextProps) {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'a',
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'ul',
      'ol',
      'li',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer',
          },
        };
      },
      // ページtitleのh1と競合しないよう、CMS側見出しを1段階下げる
      h1: 'h2',
      h2: 'h3',
      h3: 'h4',
      h4: 'h5',
      h5: 'h6',
      h6: 'h6',
    },
  });

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
