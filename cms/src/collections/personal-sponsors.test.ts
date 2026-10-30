import { describe, expect, it } from 'vitest';

import { collections } from './index';

const collection = () => collections.find((item) => item.slug === 'personal_sponsors');
const executive = { id: 1, role: 'executive' };
const student = { id: 2, role: 'student_exhibitor' };

describe('個人協賛の登録', () => {
  it('独立したコレクションに公開用表示名のみを持つ', () => {
    expect(collection()).toMatchObject({
      slug: 'personal_sponsors',
      labels: { singular: '個人協賛', plural: '個人協賛' },
      admin: { useAsTitle: 'name', group: 'サイト掲載' },
      orderable: true,
      fields: [{ name: 'name', type: 'text', label: '公開用表示名', required: true, maxLength: 255 }],
    });
    expect(collection()?.fields).toHaveLength(1);
  });

  it('公開読取を許可し、作成・変更・削除は実行委員だけに許可する', async () => {
    const access = collection()?.access;
    expect(access).toBeDefined();
    expect(await access!.read!({ req: { user: null } } as never)).toBe(true);
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(await access![operation]!({ req: { user: executive } } as never)).toBe(true);
      expect(await access![operation]!({ req: { user: student } } as never)).toBe(false);
      expect(await access![operation]!({ req: { user: null } } as never)).toBe(false);
    }
  });

  it('管理画面では実行委員に表示し学生団体には表示しない', () => {
    const hidden = collection()?.admin?.hidden;
    expect(typeof hidden).toBe('function');
    if (typeof hidden !== 'function') throw new Error('admin.hidden is not configured');
    expect(hidden({ user: executive } as never)).toBe(false);
    expect(hidden({ user: student } as never)).toBe(true);
  });
});
