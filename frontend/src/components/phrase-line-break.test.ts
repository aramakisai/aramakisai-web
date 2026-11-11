import { describe, expect, it } from 'vitest';
import { joinWithinPhrases } from './phrase-line-break';

describe('joinWithinPhrases', () => {
  it('ZWSP の前後には入れず句内の文字間に U+2060 を入れ、二重適用で変わらない', () => {
    const src = '約28分、​「群馬大学荒牧」​下車。';
    const out = joinWithinPhrases(src);
    expect(out).toBe('約⁠2⁠8⁠分⁠、​「⁠群⁠馬⁠大⁠学⁠荒⁠牧⁠」​下⁠車⁠。');
    expect(joinWithinPhrases(out)).toBe(out);
  });
});
