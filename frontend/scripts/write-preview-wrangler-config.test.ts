import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPreviewConfig } from './write-preview-wrangler-config';

const PROD_ID = '534d1e5f-bbef-4a61-bc90-83e2df91f4d0';
const DEV_ID = '9275b4b9-2da3-4058-85f1-43aa5040f04c';
const real = readFileSync(path.resolve(__dirname, '../wrangler.toml'), 'utf-8');

describe('toPreviewConfig', () => {
  it('points the top-level STAMP_DB at the dev database', () => {
    const out = toPreviewConfig(real);
    const top = out.slice(0, out.indexOf('[env.dev]'));
    expect(top).toContain(`database_id = "${DEV_ID}"`);
    expect(top).toContain('database_name = "aramakisai-stamps-dev"');
    expect(out).not.toContain(PROD_ID);
  });

  it('changes only the two D1 lines', () => {
    const before = real.split('\n');
    const changed = toPreviewConfig(real)
      .split('\n')
      .filter((l, i) => l !== before[i]);
    expect(changed).toHaveLength(2);
  });

  it('throws when there is no dev database to point at', () => {
    expect(() => toPreviewConfig('name = "a"\n')).toThrow();
  });
});
