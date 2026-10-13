import type { Metadata } from 'next';
import { getAnnouncements } from '@/lib/announcements';
import { AnnouncementsPagedList } from '@/components/announcements-paged-list';
import { SectionHeading } from '@/components/section-heading';
import { AnnouncementSummary } from '@/lib/home-page-types';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/announcements'];

  // ページ番号を含む URL でも canonical は一覧の正規パスに固定する (要件2.9)
  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/announcements',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function AnnouncementsPage() {
  let announcements: AnnouncementSummary[];
  try {
    announcements = await getAnnouncements();
  } catch {
    announcements = [];
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-12 lg:gap-6 lg:px-20 lg:pt-12 lg:pb-20">
      <SectionHeading level="h1" className="mb-0! text-center">
        お知らせ
      </SectionHeading>
      <AnnouncementsPagedList announcements={announcements} />
    </div>
  );
}
