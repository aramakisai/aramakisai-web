import { describe, expect, it } from 'vitest';

import { resolveRole } from './role-mapping';

describe('resolveRole', () => {
  it('executive グループを実行委員へ写像する', () => {
    expect(resolveRole(['executive'])).toBe('executive');
  });

  it('管理者グループを実行委員へ写像する', () => {
    expect(resolveRole(['管理者'])).toBe('executive');
  });

  it('student_exhibitor グループは写像せずロール無しになる (荒牧祭SSOから学生団体を切り離す)', () => {
    expect(resolveRole(['student_exhibitor'])).toBeNull();
  });

  it('executive と student_exhibitor を両方持つ場合も実行委員として写像する', () => {
    expect(resolveRole(['student_exhibitor', 'executive'])).toBe('executive');
  });

  it('既知のグループに一致しない場合は null を返す', () => {
    expect(resolveRole(['guests'])).toBeNull();
    expect(resolveRole([])).toBeNull();
  });
});
