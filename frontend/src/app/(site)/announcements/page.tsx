import type { Metadata } from 'next';
import { getAnnouncements } from '@/lib/announcements';
import { paginate } from '@/lib/exhibitions';
import { AnnouncementsList } from '@/components/announcements-list';
import { ExhibitionPagination } from '@/components/exhibition-pagination';
import { SectionHeading } from '@/components/section-heading';
import { AnnouncementSummary } from '@/lib/home-page-types';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

const PAGE_SIZE = 10;

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

interface AnnouncementsPageProps {
  searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}

function parsePage(raw: string | readonly string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AnnouncementsPage({
  searchParams,
}: AnnouncementsPageProps) {
  const requestedPage = parsePage((await searchParams).page);

  let announcements: AnnouncementSummary[];
  try {
    announcements = await getAnnouncements();
  } catch {
    announcements = [];
  }

  const { items, page, pageCount } = paginate(
    announcements,
    requestedPage,
    PAGE_SIZE,
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-12 lg:gap-6 lg:px-20 lg:pt-12 lg:pb-20">
      <SectionHeading level="h1" className="mb-0! text-center">
        お知らせ
      </SectionHeading>
      <AnnouncementsList announcements={[...items]} />
      <ExhibitionPagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => `/announcements?page=${p}`}
      />
    </div>
  );
}
