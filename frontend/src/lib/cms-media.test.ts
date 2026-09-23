import { describe, it, expect } from 'vitest';
import { toAttachment, toAttachments } from './cms-media';
import type { Media } from '@/cms-types';

// テスト対象は id/filename/mimeType/filesize しか見ないため、Media の必須フィールドはダミー値で埋める
function media(fields: Partial<Media> & { id: number }): Media {
  return { updatedAt: '', createdAt: '', ...fields } as Media;
}

describe('toAttachment', () => {
  it('media オブジェクトから filesize を取り出す', () => {
    expect(
      toAttachment(
        media({
          id: 1,
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          filesize: 1782579,
        }),
      ),
    ).toEqual({
      id: '1',
      filenameDownload: 'a.pdf',
      type: 'application/pdf',
      filesize: 1782579,
    });
  });

  it('filesize が無い media では null を返す', () => {
    expect(
      toAttachment(
        media({ id: 1, filename: 'a.pdf', mimeType: 'application/pdf' }),
      ),
    ).toEqual({
      id: '1',
      filenameDownload: 'a.pdf',
      type: 'application/pdf',
      filesize: null,
    });
  });

  it('ID のみの参照では filesize は null になる', () => {
    expect(toAttachment(1)).toEqual({
      id: '1',
      filenameDownload: '',
      type: null,
      filesize: null,
    });
  });

  it('null / undefined では null を返す', () => {
    expect(toAttachment(null)).toBeNull();
    expect(toAttachment(undefined)).toBeNull();
  });
});

describe('toAttachments', () => {
  it('filesize を含めて配列全体を変換する', () => {
    expect(
      toAttachments([
        media({
          id: 1,
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          filesize: 100,
        }),
        media({
          id: 2,
          filename: 'b.png',
          mimeType: 'image/png',
          filesize: 200,
        }),
      ]),
    ).toEqual([
      {
        id: '1',
        filenameDownload: 'a.pdf',
        type: 'application/pdf',
        filesize: 100,
      },
      { id: '2', filenameDownload: 'b.png', type: 'image/png', filesize: 200 },
    ]);
  });
});
