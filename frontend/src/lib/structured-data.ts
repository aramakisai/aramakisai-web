import type { JsonLdObject } from '@/components/json-ld';
import type { SiteMetadata } from './site-metadata';

export interface BreadcrumbItem {
  readonly name: string;
  readonly path: string;
}

interface StructuredDataInput {
  readonly site: SiteMetadata;
  readonly siteUrl: string;
}

const ORGANIZATION_NAME = '荒牧祭実行委員会';
const FAVICON_PATH = '/images/favicon.png';

export function buildOrganizationJsonLd(
  input: StructuredDataInput,
): JsonLdObject {
  const snsLinks = input.site.festival?.snsLinks ?? [];

  return {
    '@type': 'Organization',
    name: ORGANIZATION_NAME,
    url: input.siteUrl,
    logo: new URL(FAVICON_PATH, input.siteUrl).toString(),
    ...(snsLinks.length > 0
      ? { sameAs: snsLinks.map((link) => link.url) }
      : {}),
  };
}

/** Event は startDate が schema.org 上必須のため、開催日程が無ければ出力自体を諦める */
export function buildEventJsonLd(
  input: StructuredDataInput,
): JsonLdObject | null {
  const festival = input.site.festival;
  if (!festival || festival.eventDays.length === 0) return null;

  const { eventDays, venueName, venueAddress } = festival;

  return {
    '@type': 'Event',
    name: festival.name,
    description: input.site.description,
    startDate: eventDays[0].startAt,
    endDate: eventDays[eventDays.length - 1].endAt,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(venueName
      ? {
          location: {
            '@type': 'Place',
            name: venueName,
            ...(venueAddress ? { address: venueAddress } : {}),
          },
        }
      : {}),
    ...(input.site.ogImageUrl ? { image: input.site.ogImageUrl } : {}),
    url: input.siteUrl,
    organizer: buildOrganizationJsonLd(input),
  };
}

export function buildBreadcrumbJsonLd(
  items: readonly BreadcrumbItem[],
  siteUrl: string,
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).toString(),
    })),
  };
}
