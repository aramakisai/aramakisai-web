import { describe, expect, it } from 'vitest';

import { isExecutive, isStudentExhibitor, toCmsUser } from './roles';

describe('toCmsUser', () => {
  it('既知のロールを持つユーザーを CmsUser として復元する', () => {
    expect(toCmsUser({ id: 1, role: 'executive' })).toEqual({
      id: 1,
      role: 'executive',
    });
  });

  it('未知のロールは復元しない', () => {
    expect(toCmsUser({ id: 1, role: 'admin' })).toBeNull();
  });

  it('未認証 (null) は復元しない', () => {
    expect(toCmsUser(null)).toBeNull();
    expect(toCmsUser(undefined)).toBeNull();
  });
});

describe('ロール述語', () => {
  it('実行委員を判別する', () => {
    expect(isExecutive({ id: 1, role: 'executive' })).toBe(true);
    expect(isExecutive({ id: 1, role: 'student_exhibitor' })).toBe(false);
    expect(isExecutive(null)).toBe(false);
  });

  it('出展者を判別する', () => {
    expect(isStudentExhibitor({ id: 1, role: 'student_exhibitor' })).toBe(true);
    expect(isStudentExhibitor(null)).toBe(false);
  });
});
