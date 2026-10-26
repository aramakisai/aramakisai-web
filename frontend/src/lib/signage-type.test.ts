import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

const fontSize = config.theme?.extend?.fontSize as Record<
  string,
  [string, { lineHeight: string }]
>;

describe('signage の文字の段階', () => {
  it.each([
    ['display', '104px', '100%'],
    ['hero', '64px', '100%'],
    ['title-lg', '44px', '100%'],
    ['title', '32px', '40px'],
    ['heading', '28px', '35px'],
    ['body', '24px', '38px'],
    ['meta', '24px', '30px'],
    ['label', '24px', '100%'],
    ['caption', '18px', '100%'],
  ])('signage-%s は %s / 行間 %s', (name, size, lineHeight) => {
    expect(fontSize[`signage-${name}`]).toEqual([size, { lineHeight }]);
  });

  it('太さとフォントは持たない', () => {
    for (const [key, [, opts]] of Object.entries(fontSize)) {
      if (key.startsWith('signage-')) {
        expect(Object.keys(opts)).toEqual(['lineHeight']);
      }
    }
  });
});
