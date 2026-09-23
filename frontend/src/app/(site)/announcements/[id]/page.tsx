import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnnouncementById } from '@/lib/announcements';
import { formatFullDate } from '@/lib/format-date';
import { RichText } from '@/components/rich-text';
import { RichTextImageViewer } from '@/components/rich-text-image-viewer';
import { AttachmentGallery } from '@/components/attachment-gallery';
import { BackLink, DetailColumn } from '@/components/detail-column';

export interface AnnouncementPageProps {
  params: Promise<{ id: string }>;
}

function toAnnouncementId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

async function resolveAnnouncement(id: string) {
  const announcementId = toAnnouncementId(id);
  if (announcementId === null) return null;
  return getAnnouncementById(announcementId);
}

export async function generateMetadata({
  params,
}: AnnouncementPageProps): Promise<Metadata> {
  const { id } = await params;
  const announcement = await resolveAnnouncement(id);
  return announcement ? { title: announcement.title } : {};
}

export default async function AnnouncementPage({
  params,
}: AnnouncementPageProps) {
  const { id } = await params;
  const announcement = await resolveAnnouncement(id);

  if (!announcement) {
    notFound();
  }

  return (
    <DetailColumn>
      <BackLink href="/announcements" label="お知らせ一覧に戻る" />

      <div className="flex w-full flex-col items-center gap-2">
        <h1 className="w-full text-balance py-0 text-center text-[24px] leading-[130%] text-primary lg:text-[32px] lg:leading-[125%]">
          {announcement.title}
        </h1>
        <time
          dateTime={announcement.publishedAt}
          className="w-full text-center text-sm leading-[1.6] text-gray-500"
        >
          {formatFullDate(announcement.publishedAt)}
        </time>
      </div>

      <hr className="h-px w-full border-0 bg-gray-200" />

      <RichTextImageViewer>
        <RichText html={announcement.body} />
      </RichTextImageViewer>

      {announcement.attachments.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* h2 の既定色は color/primary だが、本文の h2 と揃えるためここだけ color/text にする */}
          <h2 className="py-0 text-text">添付ファイル</h2>
          <AttachmentGallery attachments={announcement.attachments} />
        </div>
      )}
    </DetailColumn>
  );
}
