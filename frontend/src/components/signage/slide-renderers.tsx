import { paginateLostItems, paginateSponsors } from '@/lib/signage';
import { CampusMapSlide } from './slides/campus-map-slide';
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
  parking: ({ snapshot, realNow }) => (
    <ParkingSlide parking={snapshot.parking} now={realNow} />
  ),
  timetable: ({ snapshot, now }) => (
    <TimetableSlide timetable={snapshot.timetable} now={now} />
  ),
  image: ({ entry }) =>
    entry.slide.kind === 'image' ? (
      <ImageSlide image={entry.slide.image} />
    ) : null,
  campus_map: ({ snapshot, installAreaId }) =>
    snapshot.campusMap ? (
      <CampusMapSlide
        campusMap={snapshot.campusMap}
        installAreaId={installAreaId ?? null}
      />
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
