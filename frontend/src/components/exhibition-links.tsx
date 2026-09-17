import type { ExhibitionLink } from '@/lib/exhibitions';
import { SnsIcon } from './sns-icon';
import { LinkIcon } from './icons';

const PLATFORM_LABELS: Readonly<Record<ExhibitionLink['platform'], string>> = {
  x: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  line: 'LINE',
  website: '公式サイト',
};

export interface ExhibitionLinksProps {
  readonly links: readonly ExhibitionLink[];
}

export function ExhibitionLinks({ links }: ExhibitionLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <ul className="flex gap-3">
      {links.map((link, index) => (
        <li key={index}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={PLATFORM_LABELS[link.platform]}
          >
            {link.platform === 'website' ? (
              <LinkIcon />
            ) : (
              <SnsIcon platform={link.platform} />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
