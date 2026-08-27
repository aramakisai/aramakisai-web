import { describe, expect, it } from 'vitest';

import { resolveRole } from './role-mapping';

describe('resolveRole', () => {
  it('executive グループを実行委員へ写像する', () => {
    expect(resolveRole(['executive'])).toBe('executive');
  });

  it('管理者グループを実行委員へ写像する', () => {
    expect(resolveRole(['管理者'])).toBe('executive');
  });

  it('student_exhibitor グループを出展者へ写像する', () => {
    expect(resolveRole(['student_exhibitor'])).toBe('student_exhibitor');
  });

  it('実行委員と出展者を兼ねる場合は実行委員を優先する', () => {
    expect(resolveRole(['student_exhibitor', 'executive'])).toBe('executive');
  });

  it('既知のグループに一致しない場合は null を返す', () => {
    expect(resolveRole(['guests'])).toBeNull();
    expect(resolveRole([])).toBeNull();
  });
});
