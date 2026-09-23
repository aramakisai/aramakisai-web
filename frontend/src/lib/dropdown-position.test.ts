import { describe, expect, it } from 'vitest';
import { computeDropdownOffset } from './dropdown-position';

describe('computeDropdownOffset', () => {
  // Figma 実測値 (Header PC Dropdown Open, ファイル 0kWDqHsLr6xE8b4FFgR1Zx):
  // during ご案内 (233:118) は中央 1326 で右端超過のため left=1136 に、
  // before ご案内 (256:1161) は中央 1242 で収まるため left=1130 のまま。
  const bounds = { left: 80, width: 1280 }; // コンテンツ枠 左80 / 右1360

  it('during の「ご案内」は右端をコンテンツ枠 (1360) に合わせて止める', () => {
    const item = { left: 1326 - 50, width: 100 }; // center = 1326
    const offset = computeDropdownOffset(item, bounds, 224);
    expect(item.left + offset).toBe(1136);
  });

  it('before の「ご案内」は中央揃えのままコンテンツ枠に収まる', () => {
    const item = { left: 1242 - 50, width: 100 }; // center = 1242
    const offset = computeDropdownOffset(item, bounds, 224);
    expect(item.left + offset).toBe(1130);
  });

  it('左端をコンテンツ枠より超えて越える場合は左端を枠に合わせて止める', () => {
    const item = { left: 90, width: 20 }; // center = 100
    const offset = computeDropdownOffset(item, bounds, 224);
    expect(item.left + offset).toBe(80);
  });

  it('中央に十分な余白があるときは項目の水平中央に揃える', () => {
    const item = { left: 600, width: 100 }; // center = 650
    const offset = computeDropdownOffset(item, bounds, 224);
    expect(item.left + offset).toBe(650 - 112);
  });
});
