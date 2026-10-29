import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { pickRandom } from '@/lib/pick-random';
import type { SponsorListItem } from '@/lib/sponsors';
import { AdSponsorMarquee } from './ad-sponsor-marquee';
import { LocalSponsorCard } from './local-sponsor-card';
import { SectionHeading } from './section-heading';
import { TextLink } from './text-link';

export interface SponsorsListProps {
  readonly adSponsors: readonly SponsorListItem[];
  readonly localSponsors: readonly RegionalSponsor[];
}

const LOCAL_COUNT = 4;

export function SponsorsList({ adSponsors, localSponsors }: SponsorsListProps) {
  const locals = pickRandom(localSponsors, LOCAL_COUNT);

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 lg:px-20 lg:py-12">
      <SectionHeading level="h2">協賛</SectionHeading>
      <div className="flex flex-col gap-4 lg:gap-6">
        <SectionHeading level="h3" className="!mb-0">
          広告協賛
        </SectionHeading>
        {adSponsors.length > 0 && <AdSponsorMarquee sponsors={adSponsors} />}
        <TextLink href="/sponsors/ad" className="self-end">
          広告協賛へ
        </TextLink>
        <SectionHeading level="h3" className="!mb-0">
          地域協賛
        </SectionHeading>
        {locals.length > 0 && (
          <div className="flex gap-6 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible">
            {locals.map((sponsor) => (
              <div key={sponsor.id} className="w-[280px] shrink-0 lg:w-auto">
                <LocalSponsorCard sponsor={sponsor} />
              </div>
            ))}
          </div>
        )}
        <TextLink href="/sponsors/local" className="self-end">
          地域協賛へ
        </TextLink>
      </div>
    </section>
  );
}
