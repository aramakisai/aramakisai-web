/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { AdSponsorsByTier, AdTier } from '@/lib/advertising-sponsors';
import { HoverLineText } from './hover-line';

const tiers: readonly AdTier[] = ['planA', 'planB', 'planC', 'planD'];

const tierStyles: Record<AdTier, { grid: string; card: string; logo: string }> =
  {
    planA: {
      grid: 'grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6',
      card: 'aspect-[7/3]',
      logo: 'w-[calc(100%*300/358)] aspect-[300/110] lg:w-[calc(100%*460/548)] lg:aspect-[460/170]',
    },
    planB: {
      grid: 'grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6',
      card: 'aspect-[2/1]',
      logo: 'w-[calc(100%*145/173)] aspect-[145/60] lg:w-[calc(100%*300/357)] lg:aspect-[300/120]',
    },
    planC: {
      grid: 'grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4',
      card: 'aspect-[2/1]',
      logo: 'w-[calc(100%*135/173)] aspect-[135/54] lg:w-[calc(100%*220/268)] lg:aspect-[220/86]',
    },
    planD: {
      grid: 'grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-4',
      card: '',
      logo: '',
    },
  };

export function AdvertisingSponsors({
  sponsors,
}: {
  readonly sponsors: AdSponsorsByTier;
}) {
  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      {tiers.map((tier) => {
        const group = sponsors[tier];
        const style = tierStyles[tier];
        if (!group.length) return null;

        return (
          <ul key={tier} data-tier={tier} className={`grid ${style.grid}`}>
            {group.map((sponsor) => {
              const url = sponsor.url;
              if (tier === 'planD')
                return (
                  <li
                    key={sponsor.id}
                    className="min-w-0 break-words text-sm leading-[1.6] text-text"
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/row inline-block max-w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                      >
                        <HoverLineText gap={3}>{sponsor.name}</HoverLineText>
                        <span className="sr-only">新しいタブで開きます</span>
                      </a>
                    ) : (
                      sponsor.name
                    )}
                  </li>
                );

              const logo = (
                <div className={`${style.logo} overflow-hidden rounded`}>
                  <img
                    src={toAssetUrl(sponsor.logoId, 960) ?? undefined}
                    alt={sponsor.name}
                    className="h-full w-full object-contain"
                  />
                </div>
              );
              return (
                <li
                  key={sponsor.id}
                  className={`flex min-w-0 items-center justify-center rounded-lg border border-[#e6e6e6] bg-white ${style.card} ${url ? 'transition-colors duration-200 ease-out hover:border-[#d3d3d3] motion-reduce:transition-none' : ''}`}
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-full w-full items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                    >
                      {logo}
                      <span className="sr-only">新しいタブで開きます</span>
                    </a>
                  ) : (
                    logo
                  )}
                </li>
              );
            })}
          </ul>
        );
      })}
    </div>
  );
}
