import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('OpenNext build compatibility', () => {
  it('pins the supported and security-patched Next.js 15 toolchain', () => {
    expect(packageJson.dependencies.next).toBe('15.5.28');
    expect(packageJson.dependencies['@opennextjs/cloudflare']).toBe('1.20.13');
    expect(packageJson.devDependencies['eslint-config-next']).toBe('15.5.28');
    expect(packageJson.devDependencies.wrangler).toBe('4.148.0');
  });
});
