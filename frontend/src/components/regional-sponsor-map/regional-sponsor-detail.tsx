'use client';

import { useEffect, useRef } from 'react';
import {
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  REGIONAL_SPONSOR_CATEGORY_STYLES,
} from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorIcon } from './regional-sponsor-icon';
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
}

export function RegionalSponsorDetail({
  sponsor,
  onBack,
}: RegionalSponsorDetailProps) {
  const articleRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const category = REGIONAL_SPONSOR_CATEGORY_LABELS[sponsor.category];
  const style = REGIONAL_SPONSOR_CATEGORY_STYLES[sponsor.category];
  const hoursLabel =
    sponsor.category === 'hospital' ? '診療時間・休診日' : '営業時間・定休日';
  const websiteUrl = safeWebsiteUrl(sponsor.websiteUrl);
  const hasHours =
    sponsor.businessHours !== null || sponsor.closedDays !== null;
  const hasInfo =
    sponsor.address !== null ||
    hasHours ||
    sponsor.phone !== null ||
    websiteUrl !== null;

  useEffect(() => {
    if (articleRef.current) articleRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [sponsor.id]);

  return (
    <article
      ref={articleRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex h-10 items-center gap-2 rounded-md px-1 text-sm font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RegionalSponsorIcon name="arrow-back" />
        店舗一覧に戻る
      </button>
      <SponsorImage
        sponsor={sponsor}
        variant="detail"
        className="aspect-video w-full"
      />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-display text-2xl font-extrabold leading-8 text-text focus:outline-none"
      >
        {sponsor.name}
      </h1>
      <p
        className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold text-text ${style.backgroundClass}`}
      >
        {category}
      </p>

      {sponsor.message && (
        <section
          className="mt-6 rounded-lg bg-gray-50 p-4"
          aria-labelledby="regional-sponsor-message-title"
        >
          <h2
            id="regional-sponsor-message-title"
            className="font-display text-base font-bold text-text"
          >
            メッセージ
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {sponsor.message}
          </p>
        </section>
      )}

      {hasInfo && (
        <section
          className="mt-6 rounded-lg border border-gray-200 p-4"
          aria-labelledby="regional-sponsor-info-title"
        >
          <h2
            id="regional-sponsor-info-title"
            className="font-display text-base font-bold text-text"
          >
            基本情報
          </h2>
          <dl className="mt-3 divide-y divide-gray-200 text-sm">
            {sponsor.address && (
              <div className="py-3 first:pt-0 last:pb-0">
                <dt className="font-bold text-gray-600">住所</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6 text-text">
                  {sponsor.address}
                </dd>
              </div>
            )}
            {hasHours && (
              <div className="py-3 first:pt-0 last:pb-0">
                <dt className="font-bold text-gray-600">{hoursLabel}</dt>
                <dd className="mt-1 space-y-1 leading-6 text-text">
                  {sponsor.businessHours && (
                    <p className="whitespace-pre-wrap">
                      {sponsor.businessHours}
                    </p>
                  )}
                  {sponsor.closedDays && (
                    <p className="whitespace-pre-wrap">{sponsor.closedDays}</p>
                  )}
                </dd>
              </div>
            )}
            {sponsor.phone && (
              <div className="py-3 first:pt-0 last:pb-0">
                <dt className="font-bold text-gray-600">電話番号</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6 text-text">
                  {sponsor.phone}
                </dd>
              </div>
            )}
            {websiteUrl && (
              <div className="py-3 first:pt-0 last:pb-0">
                <dt className="sr-only">Webサイト</dt>
                <dd>
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${sponsor.name}の公式Webサイト（外部サイト）`}
                    className="inline-flex items-center gap-1 font-bold text-text underline decoration-primary decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    公式Webサイト
                    <RegionalSponsorIcon name="open-in-new" size={18} />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </article>
  );
}
