import { describe, expect, it } from 'vitest';

import { canCreate, canDelete, canRead, canUpdate } from './policy';
import type { CmsUser } from './roles';

const NOW = '2026-08-27T00:00:00.000Z';
const executive: CmsUser = { id: 'exec-1', role: 'executive' };
const exhibitor: CmsUser = { id: 'user-1', role: 'student_exhibitor' };

describe('canRead', () => {
  it('実行委員は全コレクションを無条件で読める', () => {
    expect(canRead(executive, 'student_exhibitions', NOW)).toBe(true);
    expect(canRead(executive, 'announcements', NOW)).toBe(true);
    expect(canRead(executive, 'users', NOW)).toBe(true);
  });

  it('未認証は公開済みのお知らせのみ読める', () => {
    expect(canRead(null, 'announcements', NOW)).toEqual({
      published_at: { less_than_equal: NOW, exists: true },
    });
  });

  it('未認証は公開済みの学生企画のみ読める', () => {
    expect(canRead(null, 'student_exhibitions', NOW)).toEqual({
      status: { equals: 'published' },
    });
  });

  it('公開状態を持たないコレクションは未認証でも全件読める', () => {
    expect(canRead(null, 'pages', NOW)).toBe(true);
    expect(canRead(null, 'stages', NOW)).toBe(true);
  });

  it('未認証はユーザーを読めない', () => {
    expect(canRead(null, 'users', NOW)).toBe(false);
  });

  it('出展者は公開済みの学生企画に加えて自分のレコードを読める', () => {
    expect(canRead(exhibitor, 'student_exhibitions', NOW)).toEqual({
      or: [{ status: { equals: 'published' } }, { owner: { equals: 'user-1' } }],
    });
  });
});

describe('canCreate', () => {
  it('実行委員はどのコレクションでも作成できる', () => {
    expect(canCreate(executive, 'announcements')).toBe(true);
    expect(canCreate(executive, 'student_exhibitions')).toBe(true);
  });

  it('出展者は学生企画のみ作成できる', () => {
    expect(canCreate(exhibitor, 'student_exhibitions')).toBe(true);
  });

  it('出展者は画像をアップロードできる', () => {
    expect(canCreate(exhibitor, 'media')).toBe(true);
  });

  it('出展者は他のコレクションを作成できない', () => {
    expect(canCreate(exhibitor, 'announcements')).toBe(false);
    expect(canCreate(exhibitor, 'sponsors')).toBe(false);
    expect(canCreate(exhibitor, 'users')).toBe(false);
  });

  it('未認証はいかなる作成もできない', () => {
    expect(canCreate(null, 'student_exhibitions')).toBe(false);
    expect(canCreate(null, 'media')).toBe(false);
  });
});

describe('canUpdate', () => {
  it('実行委員はどのコレクションでも更新できる', () => {
    expect(canUpdate(executive, 'student_exhibitions')).toBe(true);
    expect(canUpdate(executive, 'sponsors')).toBe(true);
  });

  it('出展者は所有者フィルタ付きで学生企画を更新できる', () => {
    expect(canUpdate(exhibitor, 'student_exhibitions')).toEqual({
      owner: { equals: 'user-1' },
    });
  });

  it('出展者は他のコレクションを更新できない', () => {
    expect(canUpdate(exhibitor, 'announcements')).toBe(false);
    expect(canUpdate(exhibitor, 'media')).toBe(false);
    expect(canUpdate(exhibitor, 'users')).toBe(false);
  });

  it('未認証はいかなる更新もできない', () => {
    expect(canUpdate(null, 'student_exhibitions')).toBe(false);
  });
});

describe('canDelete', () => {
  it('出展者は所有者フィルタ付きで学生企画を削除できる', () => {
    expect(canDelete(exhibitor, 'student_exhibitions')).toEqual({
      owner: { equals: 'user-1' },
    });
  });

  it('出展者は他のコレクションを削除できない', () => {
    expect(canDelete(exhibitor, 'media')).toBe(false);
  });

  it('未認証はいかなる削除もできない', () => {
    expect(canDelete(null, 'announcements')).toBe(false);
  });
});
