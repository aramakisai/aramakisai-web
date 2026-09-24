import { describe, expect, it } from 'vitest';

import {
  canCreate,
  canDelete,
  canRead,
  canUpdate,
  EXHIBITOR_VISIBLE,
  isHiddenInAdmin,
} from './policy';
import type { CmsUser } from './roles';

const NOW = '2026-08-27T00:00:00.000Z';
const executive: CmsUser = { id: 'exec-1', role: 'executive' };
const exhibitor: CmsUser = { id: 'user-1', role: 'student_exhibitor' };

describe('canRead', () => {
  it('実行委員は全コレクションを無条件で読める', () => {
    expect(canRead(executive, 'student_exhibitions', NOW)).toBe(true);
    expect(canRead(executive, 'announcements', NOW)).toBe(true);
    expect(canRead(executive, 'media', NOW)).toBe(true);
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

  it('出展者は学生企画について自分が所有者のものだけ読める (公開済み他団体は含まない)', () => {
    expect(canRead(exhibitor, 'student_exhibitions', NOW)).toEqual({
      owner: { equals: 'user-1' },
    });
  });

  it('出展者は自分のユーザーレコードだけ読める', () => {
    expect(canRead(exhibitor, 'users', NOW)).toEqual({ id: { equals: 'user-1' } });
  });

  it('出展者以外に変わらず必要な公開 read はそのまま (マップエリア等)', () => {
    expect(canRead(exhibitor, 'map_areas', NOW)).toBe(true);
  });

  it('出展者は自分が所有者のメディアだけ読める', () => {
    expect(canRead(exhibitor, 'media', NOW)).toEqual({ owner: { equals: 'user-1' } });
  });

  it('未認証は所有者なし・実行委員所有・公開企画で使用中のメディアだけ読める', () => {
    expect(canRead(null, 'media', NOW)).toEqual({
      or: [
        { owner: { exists: false } },
        { 'owner.role': { equals: 'executive' } },
        { used_in_published: { equals: true } },
      ],
    });
  });
});

describe('canCreate', () => {
  it('実行委員はどのコレクションでも作成できる', () => {
    expect(canCreate(executive, 'announcements')).toBe(true);
    expect(canCreate(executive, 'student_exhibitions')).toBe(true);
  });

  it('出展者は画像をアップロードできる', () => {
    expect(canCreate(exhibitor, 'media')).toBe(true);
  });

  it('出展者は学生企画を作成できない (受け皿レコード方式)', () => {
    expect(canCreate(exhibitor, 'student_exhibitions')).toBe(false);
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
    expect(canUpdate(executive, 'media')).toBe(true);
    expect(canUpdate(executive, 'users')).toBe(true);
  });

  it('出展者は自分の下書きの学生企画だけ更新できる', () => {
    expect(canUpdate(exhibitor, 'student_exhibitions')).toEqual({
      and: [{ owner: { equals: 'user-1' } }, { status: { equals: 'draft' } }],
    });
  });

  it('出展者は自分が所有者かつ未使用のメディアだけ更新できる', () => {
    expect(canUpdate(exhibitor, 'media')).toEqual({
      and: [{ owner: { equals: 'user-1' } }, { used_in_published: { equals: false } }],
    });
  });

  it('出展者は自分のユーザーレコードだけ更新できる', () => {
    expect(canUpdate(exhibitor, 'users')).toEqual({ id: { equals: 'user-1' } });
  });

  it('出展者は他のコレクションを更新できない', () => {
    expect(canUpdate(exhibitor, 'announcements')).toBe(false);
  });

  it('未認証はいかなる更新もできない', () => {
    expect(canUpdate(null, 'student_exhibitions')).toBe(false);
  });
});

describe('canDelete', () => {
  it('出展者は学生企画を削除できない', () => {
    expect(canDelete(exhibitor, 'student_exhibitions')).toBe(false);
  });

  it('出展者は自分が所有者かつ未使用のメディアだけ削除できる', () => {
    expect(canDelete(exhibitor, 'media')).toEqual({
      and: [{ owner: { equals: 'user-1' } }, { used_in_published: { equals: false } }],
    });
  });

  it('出展者はユーザーを削除できない', () => {
    expect(canDelete(exhibitor, 'users')).toBe(false);
  });

  it('未認証はいかなる削除もできない', () => {
    expect(canDelete(null, 'announcements')).toBe(false);
  });
});

describe('isHiddenInAdmin', () => {
  it('実行委員には何も隠さない', () => {
    expect(isHiddenInAdmin(executive, 'users')).toBe(false);
    expect(isHiddenInAdmin(executive, 'student_exhibitions')).toBe(false);
    expect(isHiddenInAdmin(executive, 'media')).toBe(false);
  });

  it('出展者には学生企画とメディア以外を隠す', () => {
    for (const slug of EXHIBITOR_VISIBLE) {
      expect(isHiddenInAdmin(exhibitor, slug)).toBe(false);
    }
    expect(isHiddenInAdmin(exhibitor, 'users')).toBe(true);
    expect(isHiddenInAdmin(exhibitor, 'announcements')).toBe(true);
    expect(isHiddenInAdmin(exhibitor, 'festival_meta')).toBe(true);
  });

  it('未認証にも学生企画とメディア以外を隠す (管理画面には来ないが安全側に倒す)', () => {
    expect(isHiddenInAdmin(null, 'users')).toBe(true);
    expect(isHiddenInAdmin(null, 'student_exhibitions')).toBe(false);
  });
});
