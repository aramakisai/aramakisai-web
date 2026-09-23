import { SectionHeading } from './section-heading';
import { AnnouncementsList } from './announcements-list';
import type { AnnouncementSummary } from '@/lib/home-page-types';

export interface NoticesSectionProps {
  readonly announcements: AnnouncementSummary[];
}

// 開催前・開催中どちらのトップページからも同じ部品・同じ内容で使う (design.md Requirement 1/3)。
const DISPLAY_LIMIT = 5;

export function NoticesSection({ announcements }: NoticesSectionProps) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 lg:px-20 lg:py-12">
      <SectionHeading level="h2">お知らせ</SectionHeading>
      <AnnouncementsList announcements={announcements} limit={DISPLAY_LIMIT} />
    </section>
  );
}
