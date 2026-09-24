import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import { denyField, executiveOnlyField } from './payload-access';

const reqWith = (user: unknown) => ({ user }) as unknown as PayloadRequest;

describe('executiveOnlyField', () => {
  it('実行委員には true を返す', () => {
    expect(executiveOnlyField({ req: reqWith({ id: 1, role: 'executive' }) } as never)).toBe(
      true,
    );
  });

  it('出展者・未認証には false を返す', () => {
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
