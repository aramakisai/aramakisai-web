import { getAnnouncements } from '@/lib/announcements';
import { AnnouncementsList } from '@/components/announcements-list';
import { AnnouncementSummary } from '@/lib/home-page-types';

export default async function AnnouncementsPage() {
  let announcements: AnnouncementSummary[];
  try {
    announcements = await getAnnouncements();
  } catch {
    announcements = [];
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:py-12">
      <h1 className="font-bold border-b border-gray-200 pb-2">お知らせ</h1>
      <AnnouncementsList announcements={announcements} />
    </main>
  );
}
