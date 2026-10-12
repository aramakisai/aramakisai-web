import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  readFileSync(path.resolve(__dirname, file), 'utf-8');

describe('signage-hub の Worker', () => {
  it('setTimeout / setInterval を使わない(hibernation を妨げる。遅延は alarm)', () => {
    expect(read('index.ts')).not.toMatch(/\bset(Timeout|Interval)\b/);
  });

  it('公開の URL を持たず、SQLite backed の DO と SITE の service binding を宣言する', () => {
    const toml = read('wrangler.toml');
    expect(toml).toMatch(/^name = "aramakisai-signage-hub"/m);
    expect(toml).toMatch(/^workers_dev = false/m);
    expect(toml).toMatch(/^preview_urls = false/m);
    expect(toml).toMatch(/new_sqlite_classes = \["SignageHub"\]/);
    expect(toml).toMatch(/binding = "SITE"/);
    expect(toml).toMatch(/class_name = "SignageHub"/);
  });
});
