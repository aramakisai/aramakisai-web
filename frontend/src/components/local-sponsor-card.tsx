import { MaterialIcon } from '@/components/icons';
import { SponsorImage } from '@/components/regional-sponsor-map/sponsor-image';
import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

function IconLine({
  icon,
  text,
}: {
  readonly icon: string;
  readonly text: string;
}) {
  return (
    <p className="flex gap-1 text-sm leading-[1.6] text-text">
      <MaterialIcon name={icon} size={20} className="shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
    </p>
  );
}

export function LocalSponsorCard({
  sponsor,
}: {
  readonly sponsor: RegionalSponsor;
}) {
  const category = getRegionalSponsorCategoryPresentation(sponsor.category);
  return (
    <div className="flex flex-col gap-2">
      <SponsorImage
        sponsor={sponsor}
        variant="detail"
        className="aspect-[4/3] w-full"
      />
      <p className="text-xl font-bold leading-[30px] text-text">
        {sponsor.name}
      </p>
      <p
        // Figma のタグ幅は 48 + 8 × 文字数 (地域協賛詳細と同じ)
        style={{ width: 48 + 8 * [...category.label].length }}
        className={`inline-flex h-8 items-center justify-center self-start whitespace-nowrap rounded-full px-3 text-sm font-medium leading-5 text-white ${category.backgroundClass}`}
      >
        {category.label}
      </p>
      {sponsor.address && (
        <IconLine icon="location_on" text={sponsor.address} />
      )}
      {sponsor.message && (
        <IconLine icon="chat_bubble" text={sponsor.message} />
      )}
    </div>
  );
}
