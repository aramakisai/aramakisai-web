import { notFound } from 'next/navigation';
import { getAnnouncementById } from '@/lib/announcements';
import { RichText } from '@/components/rich-text';
import { AttachmentGallery } from '@/components/attachment-gallery';

export interface AnnouncementPageProps {
  params: Promise<{ id: string }>;
}

export default async function AnnouncementPage({
  params,
}: AnnouncementPageProps) {
  const { id } = await params;
  const announcementId = Number(id);

  if (isNaN(announcementId)) {
    notFound();
  }

  const announcement = await getAnnouncementById(announcementId);

  if (!announcement) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:py-12">
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold mb-2">{announcement.title}</h1>
        <time
          dateTime={announcement.publishedAt}
          className="text-gray-500 text-sm"
        >
          {announcement.publishedAt}
        </time>
      </header>

      <div className="prose max-w-none">
        <RichText html={announcement.body} />
      </div>

      {announcement.attachments && announcement.attachments.length > 0 && (
        <section className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-lg font-bold mb-4">添付ファイル</h2>
          <AttachmentGallery attachments={announcement.attachments} />
        </section>
      )}
    </main>
  );
}
