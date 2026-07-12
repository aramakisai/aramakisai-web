import React from 'react';
import { SnsLink } from '../lib/home-page-types';

export interface SnsLinksProps {
  snsLinks: SnsLink[];
}

export function SnsLinks({ snsLinks }: SnsLinksProps) {
  if (!snsLinks || snsLinks.length === 0) {
    return null;
  }

  return (
    <ul className="flex gap-4">
      {snsLinks.map((sns, index) => (
        <li key={`${sns.platform}-${index}`}>
          <a
            href={sns.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
          >
            {sns.platform}
          </a>
        </li>
      ))}
    </ul>
  );
}
