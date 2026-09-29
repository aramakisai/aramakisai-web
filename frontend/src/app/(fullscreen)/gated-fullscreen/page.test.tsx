import { describe, expect, it, vi } from 'vitest';
import { notFound } from 'next/navigation';
import GatedFullscreenPage, { generateMetadata } from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

describe('GatedFullscreenPage', () => {
  it('常に notFound を呼ぶ', () => {
    expect(() => GatedFullscreenPage()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  it('notFound を呼び、ルート not-found.tsx 側のメタデータへフォールバックさせる', () => {
    expect(() => generateMetadata()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
