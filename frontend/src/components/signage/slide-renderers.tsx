import { paginateLostItems, paginateSponsors } from '@/lib/signage';
import { ImageSlide } from './slides/image';
import { LayoutSlide } from './slides/layout';
import { LostItemsSlide } from './slides/lost-items';
import { ParkingSlide } from './slides/parking-slide';
import { SponsorsSlide } from './slides/sponsors';
import { TimetableSlide } from './slides/timetable-slide';
import type { SlideRenderers } from './signage-main';

export const SLIDE_RENDERERS: SlideRenderers = {
  sponsors: ({ entry, snapshot }) => (
    <SponsorsSlide
      rows={paginateSponsors(snapshot.sponsors)[entry.page] ?? []}
    />
  ),
  lost_items: ({ entry, snapshot }) => (
    <LostItemsSlide
      items={paginateLostItems(snapshot.lostItems)[entry.page] ?? []}
    />
  ),
  parking: ({ snapshot }) => <ParkingSlide parking={snapshot.parking} />,
  timetable: ({ snapshot, now }) => (
    <TimetableSlide timetable={snapshot.timetable} now={now} />
  ),
  image: ({ entry }) =>
    entry.slide.kind === 'image' ? (
      <ImageSlide kind="image" image={entry.slide.image} />
    ) : null,
  campus_map: ({ entry }) =>
    entry.slide.kind === 'campus_map' ? (
      <ImageSlide kind="campus_map" image={entry.slide.image} />
    ) : null,
  layout: ({ entry }) =>
    entry.slide.kind === 'layout' ? (
      <LayoutSlide
        layout={entry.slide.layout}
        tone={entry.slide.tone}
        title={entry.slide.title}
        subtext={entry.slide.subtext}
        content1Html={entry.slide.content1Html}
        content2Html={entry.slide.content2Html}
      />
    ) : null,
};
