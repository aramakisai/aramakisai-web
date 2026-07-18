import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTopics, getTopicById } from './topics';
import { directus } from './directus';
import { readItems, readItem } from '@directus/sdk';

vi.mock('./directus', () => ({
  directus: {
    request: vi.fn(),
  },
}));

vi.mock('@directus/sdk', () => ({
  readItems: vi.fn((collection: string, query?: unknown) => ({
    type: 'readItems',
    collection,
    query,
  })),
  readItem: vi.fn(
    (collection: string, id: string | number, query?: unknown) => ({
      type: 'readItem',
      collection,
      id,
      query,
    }),
  ),
}));

describe('TopicsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopics', () => {
    it('returns formatted topics with sorted attachments', async () => {
      vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
        const request = req as { type?: string; collection?: string };
        if (request.type === 'readItems' && request.collection === 'topics') {
          return [
            {
              id: 1,
              title: 'Topic 1',
              body: 'Body 1',
              image: 'img1',
              attachments: [
                {
                  sort: 2,
                  directus_files_id: {
                    id: 'file2',
                    filename_download: 'test2.pdf',
                    type: 'application/pdf',
                  },
                },
                {
                  sort: 1,
                  directus_files_id: {
                    id: 'file1',
                    filename_download: 'test1.pdf',
                    type: 'application/pdf',
                  },
                },
              ],
            },
          ];
        }
        return [];
      });

      const result = await getTopics();

      expect(readItems).toHaveBeenCalledWith('topics', {
        sort: ['sort'],
        fields: [
          '*',
          'attachments.sort',
          'attachments.directus_files_id.id',
          'attachments.directus_files_id.filename_download',
          'attachments.directus_files_id.type',
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        title: 'Topic 1',
        body: 'Body 1',
        imageId: 'img1',
        attachments: [
          {
            id: 'file1',
            filenameDownload: 'test1.pdf',
            type: 'application/pdf',
          },
          {
            id: 'file2',
            filenameDownload: 'test2.pdf',
            type: 'application/pdf',
          },
        ],
      });
    });
  });

  describe('getTopicById', () => {
    it('returns formatted topic by id', async () => {
      vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
        const request = req as {
          type?: string;
          collection?: string;
          id?: number;
        };
        if (
          request.type === 'readItem' &&
          request.collection === 'topics' &&
          request.id === 1
        ) {
          return {
            id: 1,
            title: 'Topic 1',
            body: 'Body 1',
            image: 'img1',
            attachments: [
              {
                sort: null,
                directus_files_id: {
                  id: 'file1',
                  filename_download: 'test1.pdf',
                  type: 'application/pdf',
                },
              },
            ],
          };
        }
        return null;
      });

      const result = await getTopicById(1);

      expect(readItem).toHaveBeenCalledWith('topics', 1, {
        fields: [
          '*',
          'attachments.sort',
          'attachments.directus_files_id.id',
          'attachments.directus_files_id.filename_download',
          'attachments.directus_files_id.type',
        ],
      });

      expect(result).toEqual({
        id: 1,
        title: 'Topic 1',
        body: 'Body 1',
        imageId: 'img1',
        attachments: [
          {
            id: 'file1',
            filenameDownload: 'test1.pdf',
            type: 'application/pdf',
          },
        ],
      });
    });

    it('returns null when topic does not exist', async () => {
      vi.mocked(directus.request).mockRejectedValue(
        new Error('Network error or 404'),
      );

      const result = await getTopicById(999);

      expect(result).toBeNull();
    });
  });
});
