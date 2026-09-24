import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnnouncementById } from '@/lib/announcements';
import { formatFullDate } from '@/lib/format-date';
import { RichText } from '@/components/rich-text';
import { RichTextImageViewer } from '@/components/rich-text-image-viewer';
import { AttachmentGallery } from '@/components/attachment-gallery';
import { BackLink, DetailColumn } from '@/components/detail-column';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { toMetaDescription } from '@/lib/meta-description';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/json-ld';
import { env } from '@/env';

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
  const [announcement, site] = await Promise.all([
    resolveAnnouncement(id),
    getSiteMetadata(),
  ]);

  return buildPageMetadata({
    site,
    title: announcement?.title ?? site.siteTitle,
    description: toMetaDescription(
      [announcement?.metaDescription, announcement?.body],
      site.description,
    ),
    // '1.0' や '01' 等の非正規表記が別 URL として canonical 宣言されるのを防ぐため、
    // 解決できた場合は正規化済みの announcement.id を使う
    path: `/announcements/${announcement?.id ?? id}`,
    ogType: 'article',
    imageCandidates: [announcement?.ogImageId ?? null],
  });
}

export default async function AnnouncementPage({
  params,
}: AnnouncementPageProps) {
  const { id } = await params;
  const announcement = await resolveAnnouncement(id);

  if (!announcement) {
    notFound();
  }

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: 'お知らせ', path: '/announcements' },
      { name: announcement.title, path: `/announcements/${announcement.id}` },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <DetailColumn>
      <JsonLd data={breadcrumb} />
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
