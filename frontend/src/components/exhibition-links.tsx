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
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs leading-[140%] font-medium text-gray-500">リンク</p>
      <ul className="flex flex-wrap items-center gap-2">
        {links.map((link, index) => (
          <li key={index}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={PLATFORM_LABELS[link.platform]}
              className="flex items-center justify-center rounded-full border border-gray-200 bg-background p-2"
            >
              {link.platform === 'website' ? (
                <LinkIcon size={20} />
              ) : (
                <span className="flex size-5 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
                  <SnsIcon platform={link.platform} />
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
