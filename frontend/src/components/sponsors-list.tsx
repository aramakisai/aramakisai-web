/* eslint-disable @next/next/no-img-element */
import React from 'react';

export interface SponsorItem {
  id: number;
  name: string;
  logoUrl: string | null;
  url: string | null;
}

export interface SponsorsListProps {
  sponsors: SponsorItem[];
}

export function SponsorsList({ sponsors }: SponsorsListProps) {
  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {sponsors.map((sponsor) => {
        const inner = sponsor.logoUrl ? (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className="max-h-16 w-full object-contain"
          />
        ) : (
          <span className="text-sm font-medium text-gray-700">
            {sponsor.name}
          </span>
        );

        return (
          <li
            key={sponsor.id}
            className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-4"
          >
            {sponsor.url ? (
              <a
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full items-center justify-center"
                aria-label={sponsor.name}
              >
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
