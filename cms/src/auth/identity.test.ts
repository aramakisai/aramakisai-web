import { describe, expect, it } from 'vitest';

import { toCmsIdentity } from './identity';

describe('toCmsIdentity', () => {
  it('既知のグループを持つ userinfo をロール付きの識別情報へ写像する', () => {
    expect(
      toCmsIdentity({ sub: 'abc', email: 'a@example.com', groups: ['executive'] }),
    ).toEqual({ subject: 'abc', email: 'a@example.com', role: 'executive' });
  });

  it('既知のグループに一致しない場合は null を返しセッションを確立させない', () => {
    expect(toCmsIdentity({ sub: 'abc', email: 'a@example.com', groups: ['guests'] })).toBeNull();
  });

  it('email がない userinfo は受け付けない', () => {
    expect(toCmsIdentity({ sub: 'abc', groups: ['executive'] })).toBeNull();
  });

  it('sub がない userinfo は受け付けない', () => {
    expect(toCmsIdentity({ email: 'a@example.com', groups: ['executive'] })).toBeNull();
  });

  it('groups が配列でない場合は受け付けない', () => {
    expect(toCmsIdentity({ sub: 'a', email: 'a@example.com' })).toBeNull();
  });
});
