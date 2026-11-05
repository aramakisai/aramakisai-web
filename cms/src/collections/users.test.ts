import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import { Users } from './users';

type NamedField = { name: string; access?: { update?: (args: unknown) => boolean }; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const reqWith = (user: unknown) => ({ user }) as unknown as PayloadRequest;

describe('role・email フィールドの access', () => {
  it('role の update は実行委員だけ許可する', () => {
    const role = fieldOf(Users.fields, 'role');
    expect(role.access?.update?.({ req: reqWith({ id: 1, role: 'executive' }) } as never)).toBe(
      true,
    );
    expect(
      role.access?.update?.({ req: reqWith({ id: 1, role: 'student_exhibitor' }) } as never),
    ).toBe(false);
  });

  it('email の update は実行委員だけ許可する (上書き定義)', () => {
    const email = fieldOf(Users.fields, 'email');
    expect(email.type).toBe('email');
    expect(email.access?.update?.({ req: reqWith({ id: 1, role: 'executive' }) } as never)).toBe(
      true,
    );
    expect(
      email.access?.update?.({ req: reqWith({ id: 1, role: 'student_exhibitor' }) } as never),
    ).toBe(false);
  });
});

describe('auth Cookie の Secure', () => {
  it('公開 URL が https のときだけ有効にする', async () => {
    const { isHttpsUrl } = await import('../env');
    expect(isHttpsUrl('https://cms.aramakisai.com')).toBe(true);
    expect(isHttpsUrl('http://localhost:3100')).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
  });

  it('Users の auth 設定に反映される (テスト環境は未設定のため false)', () => {
    expect(Users.auth).toEqual({ cookies: { secure: false } });
  });
});
