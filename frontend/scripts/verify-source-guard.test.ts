import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findForbiddenStrings, listSourceFiles } from './verify-source-guard';

describe('listSourceFiles', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('拡張子が一致するファイルを再帰的に集める', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'source-guard-test-'));
    await mkdir(path.join(dir, 'nested'), { recursive: true });
    await writeFile(path.join(dir, 'a.tsx'), 'a');
    await writeFile(path.join(dir, 'nested', 'b.ts'), 'b');
    await writeFile(path.join(dir, 'c.json'), '{}');

    const files = listSourceFiles(dir, ['.ts', '.tsx']).sort();

    expect(files).toEqual(
      [path.join(dir, 'a.tsx'), path.join(dir, 'nested', 'b.ts')].sort(),
    );
  });

  it('*.test.ts(x) を除外する', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'source-guard-test-'));
    await writeFile(path.join(dir, 'a.tsx'), 'a');
    await writeFile(path.join(dir, 'a.test.tsx'), 'a');

    const files = listSourceFiles(dir, ['.tsx']);

    expect(files).toEqual([path.join(dir, 'a.tsx')]);
  });

  it('exclude に指定したファイルを除外する', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'source-guard-test-'));
    await writeFile(path.join(dir, 'a.tsx'), 'a');
    await writeFile(path.join(dir, 'b.tsx'), 'b');

    const files = listSourceFiles(dir, ['.tsx'], ['b.tsx']);

    expect(files).toEqual([path.join(dir, 'a.tsx')]);
  });
});

describe('findForbiddenStrings', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('禁止文字列を含むファイルを検出する', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'source-guard-test-'));
    const file = path.join(dir, 'a.tsx');
    await writeFile(file, 'className="text-primary"');

    const violations = findForbiddenStrings([file], ['text-primary']);

    expect(violations).toEqual([{ file, forbidden: 'text-primary' }]);
  });

  it('含まないファイルは検出しない', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'source-guard-test-'));
    const file = path.join(dir, 'a.tsx');
    await writeFile(file, 'className="text-text"');

    const violations = findForbiddenStrings([file], ['text-primary']);

    expect(violations).toEqual([]);
  });
});
