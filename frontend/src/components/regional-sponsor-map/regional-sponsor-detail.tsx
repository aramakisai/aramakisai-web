'use client';

import { useEffect, useRef } from 'react';
import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { MaterialIcon } from '@/components/icons';
import { HoverLine } from '@/components/hover-line';
import { RegionalSponsorBackButton } from './regional-sponsor-back-button';
import { SponsorImage } from './sponsor-image';

function safeWebsiteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export interface RegionalSponsorDetailProps {
  readonly sponsor: RegionalSponsor;
  readonly onBack: () => void;
  readonly bodyInert?: boolean;
  /** Figma の縦間隔は PC パネル 16px、スマートフォンのシート 14px */
  readonly variant?: 'panel' | 'sheet';
}

export function RegionalSponsorDetail({
  sponsor,
  onBack,
  bodyInert = false,
  variant = 'panel',
}: RegionalSponsorDetailProps) {
  const articleRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const category = getRegionalSponsorCategoryPresentation(sponsor.category);
  const hoursLabel =
    sponsor.category === 'hospital' ? '診療時間・休診日' : '営業時間・定休日';
  const gap = variant === 'panel' ? 'gap-4' : 'gap-3.5';
  const websiteUrl = safeWebsiteUrl(sponsor.websiteUrl);
  const hasInfo =
    sponsor.address !== null ||
    sponsor.businessHours !== null ||
    sponsor.phone !== null ||
    websiteUrl !== null;

  useEffect(() => {
    if (articleRef.current) articleRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [sponsor.id]);

  return (
    <article
      ref={articleRef}
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-5 ${gap} ${variant === 'sheet' ? '-mt-1' : ''}`}
      data-map-sheet-scroll
    >
      <RegionalSponsorBackButton onBack={onBack} />
      <div inert={bodyInert} className={`flex flex-col ${gap}`}>
        <SponsorImage
          sponsor={sponsor}
          variant="detail"
          className="aspect-video w-full"
        />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="py-0 text-xl font-bold leading-[30px] text-text focus:outline-none"
        >
          {sponsor.name}
        </h1>
        <p
          // Figma のタグ幅はチップと同じく 48 + 8 × 文字数
          style={{ width: 48 + 8 * [...category.label].length }}
          className={`inline-flex h-8 items-center justify-center self-start rounded-full px-3 text-sm font-medium leading-5 text-white ${category.backgroundClass}`}
        >
          {category.label}
        </p>

        {sponsor.message && (
          <section
            className="flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-4"
            aria-labelledby="regional-sponsor-message-title"
          >
            <h2
              id="regional-sponsor-message-title"
              className="py-0 text-base font-bold leading-6 text-text"
            >
              メッセージ
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">
              {sponsor.message}
            </p>
          </section>
        )}

        {hasInfo && (
          <section
            className="flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-4"
            aria-labelledby="regional-sponsor-info-title"
          >
            <h2
              id="regional-sponsor-info-title"
              className="py-0 text-base font-bold leading-6 text-text"
            >
              基本情報
            </h2>
            <dl className="flex flex-col gap-2.5 text-sm [&>div+div]:border-t [&>div+div]:border-gray-200 [&>div+div]:pt-2.5">
              {sponsor.address && (
                <div>
                  <dt className="text-xs font-medium leading-[18px] text-gray-600">
                    住所
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-[22px] text-text">
                    {sponsor.address}
                  </dd>
                </div>
              )}
              {sponsor.businessHours && (
                <div>
                  <dt className="text-xs font-medium leading-[18px] text-gray-600">
                    {hoursLabel}
                  </dt>
                  <dd className="mt-1 leading-[22px] text-text">
                    <p className="whitespace-pre-wrap">
                      {sponsor.businessHours}
                    </p>
                  </dd>
                </div>
              )}
              {sponsor.phone && (
                <div>
                  <dt className="text-xs font-medium leading-[18px] text-gray-600">
                    電話番号
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-[22px] text-text">
                    {sponsor.phone}
                  </dd>
                </div>
              )}
              {websiteUrl && (
                <div>
                  <dt className="sr-only">Webサイト</dt>
                  <dd>
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${sponsor.name}の公式Webサイト（外部サイト）`}
                      className="group relative inline-flex items-center gap-1 font-normal leading-[22px] text-[#356fa8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      公式Webサイト
                      <MaterialIcon name="open_in_new" size={18} />
                      {/* text-decoration だと文字とアイコンで線が分かれるため、a 全体の下に 1 本引く */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-[5px] h-px bg-[#356fa8]"
                      />
                      <HoverLine gap={-6} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
