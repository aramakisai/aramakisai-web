/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { AdSponsorsByTier, AdTier } from '@/lib/advertising-sponsors';
import { HoverLineText } from './hover-line';

export function AdvertisingSponsorsContent({
  sponsors,
  personalSponsors,
}: {
  readonly sponsors: AdSponsorsByTier;
  readonly personalSponsors: readonly { id: number; name: string }[];
}) {
  return (
    <div className="mx-auto w-full max-w-[1152px] px-4 pt-4 pb-12 text-text lg:pt-12 lg:pb-20">
      <div className="flex flex-col items-center gap-3 text-center lg:gap-4">
        <h1 className="py-0 font-display text-[32px] font-extrabold leading-[1.25] tracking-[0.64px]">
          広告協賛
        </h1>
        <p className="max-w-[900px] text-base leading-[1.7]">
          荒牧祭2026の開催にあたり、ご協賛いただいた企業・団体の皆様に心より御礼申し上げます。
        </p>
      </div>
      <div className="mt-8 lg:mt-12">
        <AdvertisingSponsors sponsors={sponsors} />
      </div>
      <hr className="my-8 h-px border-0 bg-gray-200 lg:my-12" />
      <section
        aria-labelledby="personal-sponsors-heading"
        className="flex flex-col gap-5 lg:gap-6"
      >
        <h2
          id="personal-sponsors-heading"
          className="py-0 text-center font-display text-[20px] font-extrabold leading-[1.3]"
        >
          個人協賛者様
        </h2>
        <p className="text-center text-base leading-[1.7]">
          荒牧祭2026への温かいご支援に心より感謝申し上げます。
        </p>
        {personalSponsors.length > 0 && (
          <ul
            aria-labelledby="personal-sponsors-heading"
            className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-4"
          >
            {personalSponsors.map(({ id, name }) => (
              <li
                key={id}
                className="min-w-0 break-words text-sm leading-[1.6]"
              >
                {name.endsWith('様') ? name : `${name}様`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const tiers: readonly AdTier[] = ['planA', 'planB', 'planC', 'planD'];

const tierStyles: Record<AdTier, { grid: string; card: string; logo: string }> =
  {
    planA: {
      grid: 'grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6',
      card: 'aspect-[7/3]',
      logo: 'w-[calc((100%_+_2px)*300/358)] aspect-[300/110] lg:w-[calc((100%_+_2px)*460/548)] lg:aspect-[460/170]',
    },
    planB: {
      grid: 'grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6',
      card: 'aspect-[2/1]',
      logo: 'w-[calc((100%_+_2px)*145/173)] aspect-[145/60] lg:w-[calc((100%_+_2px)*300/357)] lg:aspect-[300/120]',
    },
    planC: {
      grid: 'grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4',
      card: 'aspect-[2/1]',
      logo: 'w-[calc((100%_+_2px)*135/173)] aspect-[135/54] lg:w-[calc((100%_+_2px)*220/268)] lg:aspect-[220/86]',
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
