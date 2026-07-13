import { readItems, readItem } from '@directus/sdk';
import { directus, type AnnouncementFile } from './directus';
import { AnnouncementSummary } from './home-page-types';

// Directus SDKの型付きfieldsはドット区切りのdeep-fields文字列を表現できないため、
// このリテラル配列のみ許容してキャストする。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ANNOUNCEMENT_FIELDS: any = [
  '*',
  'attachments.sort',
  'attachments.directus_files_id.id',
  'attachments.directus_files_id.filename_download',
  'attachments.directus_files_id.type',
];

type RawAnnouncement = {
  id: number;
  title: string;
  body: string | null;
  published_at: string | null;
  attachments?: AnnouncementFile[];
};

function mapAnnouncement(a: RawAnnouncement): AnnouncementSummary {
  const attachments = [...(a.attachments || [])]
    .sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0))
    .map((att) => {
      const file = att.directus_files_id;
      if (typeof file === 'string') {
        return { id: file, filenameDownload: '', type: null };
      }
      return {
        id: file.id,
        filenameDownload: file.filename_download,
        type: file.type,
      };
    });

  return {
    id: a.id,
    title: a.title,
    body: a.body || '',
    publishedAt: a.published_at as string,
    attachments,
  };
}

export async function getAnnouncements(): Promise<AnnouncementSummary[]> {
  const announcements = await directus.request(
    readItems('announcements', {
      fields: ANNOUNCEMENT_FIELDS,
      filter: { published_at: { _lte: '$NOW', _nnull: true } },
      sort: ['-published_at'],
      limit: -1,
    }),
  );

  return (announcements as unknown as RawAnnouncement[]).map(mapAnnouncement);
}

export async function getAnnouncementById(
  id: number,
): Promise<AnnouncementSummary | null> {
  try {
    const announcement = await directus.request(
      readItem('announcements', id, {
        fields: ANNOUNCEMENT_FIELDS,
      }),
    );
    return mapAnnouncement(announcement as unknown as RawAnnouncement);
  } catch {
    return null;
  }
}
