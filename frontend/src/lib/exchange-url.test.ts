import { describe, expect, it } from 'vitest';
import { parseExchangeUrl } from './exchange-url';

const ORIGIN = 'https://aramakisai.com';
const ID = '3f2a9c1e-1111-4111-8111-111111111111';

describe('parseExchangeUrl', () => {
  it('自サイトの照会 URL なら遷移先のパスとクエリを返す', () => {
    expect(
      parseExchangeUrl(`${ORIGIN}/staff/visitors/${ID}?t=abc.def`, ORIGIN),
    ).toBe(`/staff/visitors/${ID}?t=abc.def`);
  });

  it.each([
    ['別オリジン', `https://example.com/staff/visitors/${ID}?t=a`],
    ['署名なし', `${ORIGIN}/staff/visitors/${ID}`],
    ['署名が空', `${ORIGIN}/staff/visitors/${ID}?t=`],
    ['匿名ID形式不正', `${ORIGIN}/staff/visitors/abc?t=a`],
    ['別パス', `${ORIGIN}/exhibitions?t=a`],
    ['URL でない文字列', 'hello'],
  ])('%s は null', (_, text) => {
    expect(parseExchangeUrl(text, ORIGIN)).toBeNull();
  });
});
