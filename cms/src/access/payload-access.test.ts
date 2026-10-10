import type { PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { accessFor, denyField, executiveOnlyField } from './payload-access';

const reqWith = (user: unknown) => ({ user }) as unknown as PayloadRequest;

describe('executiveOnlyField', () => {
  it('実行委員には true を返す', () => {
    expect(executiveOnlyField({ req: reqWith({ id: 1, role: 'executive' }) } as never)).toBe(
      true,
    );
  });

  it('学生団体・未認証には false を返す', () => {
    expect(
      executiveOnlyField({ req: reqWith({ id: 1, role: 'student_exhibitor' }) } as never),
    ).toBe(false);
    expect(executiveOnlyField({ req: reqWith(null) } as never)).toBe(false);
  });
});

describe('denyField', () => {
  it('ロールを問わず常に false を返す', () => {
    expect(denyField({ req: reqWith({ id: 1, role: 'executive' }) } as never)).toBe(false);
    expect(denyField({ req: reqWith(null) } as never)).toBe(false);
  });
});

describe('accessFor の読み取り', () => {
  const find = vi
    .fn()
    .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] })
    .mockResolvedValueOnce({ docs: [{ id: 9, is_all: false, visible: true, slides: [2] }] })
    .mockResolvedValue({ docs: [] });
  const req = (user: unknown) => ({ user, payload: { find } }) as unknown as PayloadRequest;
  const read = (collection: string, user: unknown) => accessFor(collection).read({ req: req(user) } as never);

  it('未認証のスライド読み取りは、有効の条件に表示対象のIDの条件を重ねる', async () => {
    expect(await read('signage_slides', null)).toEqual({
      and: [{ enabled: { equals: true } }, { id: { in: [2] } }],
    });
  });

  it('表示対象が無ければ一致しない条件になる(false にしない)', async () => {
    expect(await read('signage_slides', null)).toEqual({
      and: [{ enabled: { equals: true } }, { id: { exists: false } }],
    });
  });

  it('実行委員の読み取りは絞らず、グループも絞らない', async () => {
    const before = find.mock.calls.length;
    expect(await read('signage_slides', { id: 1, role: 'executive' })).toBe(true);
    expect(await read('signage_groups', null)).toBe(true);
    expect(find.mock.calls.length).toBe(before);
  });
});

describe('accessFor の削除', () => {
  const del = (collection: string, user: unknown) =>
    accessFor(collection).delete({ req: reqWith(user) } as never);
  const executive = { id: 1, role: 'executive' };

  it('サイネージ グループは、実行委員には「すべて」以外だけを対象にする条件を返す', async () => {
    expect(await del('signage_groups', executive)).toEqual({ is_all: { not_equals: true } });
  });

  it('サイネージ グループは、未認証・学生団体には条件ではなく false を返す', async () => {
    expect(await del('signage_groups', null)).toBe(false);
    expect(await del('signage_groups', { id: 2, role: 'student_exhibitor' })).toBe(false);
  });

  it('他のコレクションは policy の結果のまま', async () => {
    expect(await del('signage_slides', executive)).toBe(true);
  });
});
