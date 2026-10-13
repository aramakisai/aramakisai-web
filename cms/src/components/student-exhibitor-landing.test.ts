import { describe, expect, it, vi } from 'vitest';

import { findOwnExhibitionPath } from './student-exhibitor-landing';

const mk = (docs: { id: number }[]) => ({
  config: { routes: { admin: '/admin' } },
  find: vi.fn().mockResolvedValue({ docs }),
});

describe('findOwnExhibitionPath', () => {
  it('所有ありの学生団体は編集画面のパス', async () => {
    const p = mk([{ id: 7 }]);
    const user = { id: 1, role: 'student_exhibitor' };
    expect(await findOwnExhibitionPath(p as never, user as never)).toBe('/admin/collections/student_exhibitions/7');
    expect(p.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'student_exhibitions', user, overrideAccess: false, limit: 1 }),
    );
  });
  it('所有なしの学生団体はパスなし', async () => {
    expect(await findOwnExhibitionPath(mk([]) as never, { id: 1, role: 'student_exhibitor' } as never)).toBeNull();
  });
  it('実行委員は企画を引かずパスなし', async () => {
    const p = mk([{ id: 7 }]);
    expect(await findOwnExhibitionPath(p as never, { id: 2, role: 'executive' } as never)).toBeNull();
    expect(p.find).not.toHaveBeenCalled();
  });
  it('未ログインはパスなし', async () => {
    const p = mk([]);
    expect(await findOwnExhibitionPath(p as never, null)).toBeNull();
    expect(p.find).not.toHaveBeenCalled();
  });
});
