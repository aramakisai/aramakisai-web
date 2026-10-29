import { describe, expect, it } from 'vitest';
import { isVisitorId } from './visitor-id';

describe('isVisitorId', () => {
  it('UUID v4 のみ受け付ける', () => {
    expect(isVisitorId('3b241101-e2bb-4255-8caf-4136c566a962')).toBe(true);
    expect(isVisitorId(crypto.randomUUID())).toBe(true);
    expect(isVisitorId('3b241101-e2bb-1255-8caf-4136c566a962')).toBe(false);
    expect(isVisitorId('3B241101-E2BB-4255-8CAF-4136C566A962')).toBe(false);
    expect(isVisitorId('x')).toBe(false);
    expect(isVisitorId(null)).toBe(false);
    expect(isVisitorId(1)).toBe(false);
  });
});
