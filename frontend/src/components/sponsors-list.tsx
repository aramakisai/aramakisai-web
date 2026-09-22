/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { ChevronRightIcon } from './icons';

export interface SponsorLogoItem {
  readonly id: number;
  readonly name: string;
  readonly logoId: string | null;
}

export interface SponsorsListProps {
  readonly sponsors: readonly SponsorLogoItem[];
}

// Figma 実測 (156:798 / 161:173): トップページは代表数件に留め、全件は種別ごとの一覧ページに任せる
const LOGO_LIMIT = 4;

export function SponsorsList({ sponsors }: SponsorsListProps) {
  const items = sponsors.slice(0, LOGO_LIMIT);

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-8 lg:gap-6 lg:px-20 lg:py-12">
      <h2 className="py-0">協賛</h2>
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {items.map((sponsor) => {
            const logoUrl = toAssetUrl(sponsor.logoId, 960);
            return (
              <li
                key={sponsor.id}
                className="flex h-[72px] items-center justify-center bg-gray-200 lg:h-[100px]"
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={sponsor.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-sm text-gray-500">
                    {sponsor.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end gap-4 lg:gap-6">
        <Link
          href="/sponsors/ad"
          className="flex items-center gap-2 text-sm font-bold text-primary"
        >
          広告協賛へ
          <ChevronRightIcon size={20} className="text-text" />
        </Link>
        <Link
          href="/sponsors/local"
          className="flex items-center gap-2 text-sm font-bold text-primary"
        >
          地域協賛へ
          <ChevronRightIcon size={20} className="text-text" />
        </Link>
      </div>
    </section>
  );
}
