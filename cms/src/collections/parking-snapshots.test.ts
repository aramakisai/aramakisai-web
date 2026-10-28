import { describe, expect, it } from 'vitest';

import { ParkingSnapshots } from './parking-snapshots';

type F = { name: string; [key: string]: unknown };
const field = (name: string) => ParkingSnapshots.fields.find((f) => (f as F).name === name) as F;
const user = (executive: boolean) => ({ req: { user: executive ? { id: 1, role: 'executive' } : null } }) as never;

describe('ParkingSnapshots 定義', () => {
  it('アップロードコレクションで、幅 960 の WebP 縮小版 web を 1 つ作る', () => {
    expect(ParkingSnapshots.slug).toBe('parking_snapshots');
    const upload = ParkingSnapshots.upload as {
      imageSizes: unknown[];
      formatOptions?: unknown;
    };
    expect(upload.formatOptions).toBeUndefined();
    expect(upload.imageSizes).toEqual([
      {
        name: 'web',
        width: 960,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 75 } },
      },
    ]);
  });

  it('ファイル配信に長期の Cache-Control を付ける', () => {
    const headers = new Headers();
    (ParkingSnapshots.upload as { modifyResponseHeaders: (a: { headers: Headers }) => void }).modifyResponseHeaders({
      headers,
    });
    expect(headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('一覧の列', () => {
    expect(ParkingSnapshots.admin?.defaultColumns).toEqual([
      'filename',
      'camera',
      'lot',
      'createdAt',
      'judge_status',
      'congestion',
      'image_quality',
    ]);
  });

  it('すべての項目が画面で読み取りのみで、人は書けない', () => {
    for (const f of ParkingSnapshots.fields as F[]) {
      expect((f.admin as { readOnly: boolean }).readOnly, f.name).toBe(true);
      expect((f.access as { create: () => boolean }).create(), f.name).toBe(false);
      expect((f.access as { update: () => boolean }).update(), f.name).toBe(false);
    }
  });

  it('camera・露出補正値・判定の項目は実行委員だけが読める', () => {
    for (const n of ['camera', 'exposure', 'judge_status', 'judge_error', 'congestion', 'image_quality', 'judge_model', 'judged_at']) {
      const read = (field(n).access as { read: (a: never) => boolean }).read;
      expect(read(user(true)), n).toBe(true);
      expect(read(user(false)), n).toBe(false);
    }
  });

  it('lot・captured_at は未認証にも読める (読み取り制限を持たない)', () => {
    for (const n of ['lot', 'captured_at']) {
      expect((field(n).access as { read?: unknown }).read, n).toBeUndefined();
    }
  });

  it('camera は必須、captured_at は必須', () => {
    expect(field('camera')).toMatchObject({ required: true, relationTo: 'parking_cameras' });
    expect(field('captured_at').required).toBe(true);
  });
});
