import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FORBIDDEN_STRINGS,
  findForbiddenStringsInContent,
  scanForForbiddenStrings,
} from './verify-build-artifacts';

describe('FORBIDDEN_STRINGS', () => {
  it('is non-empty', () => {
    expect(FORBIDDEN_STRINGS.length).toBeGreaterThan(0);
  });
});

describe('findForbiddenStringsInContent', () => {
  it('returns forbidden strings present in the content', () => {
    const result = findForbiddenStringsInContent('foo bar baz', ['bar', 'qux']);
    expect(result).toEqual(['bar']);
  });

  it('returns an empty array when nothing matches', () => {
    const result = findForbiddenStringsInContent('foo', ['bar']);
    expect(result).toEqual([]);
  });
});

describe('scanForForbiddenStrings', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('detects a forbidden string in a nested file', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-build-artifacts-test-'));
    await mkdir(path.join(dir, 'chunks'), { recursive: true });
    await writeFile(
      path.join(dir, 'chunks', 'app.js'),
      'const cookieName = "aramakisai_phase_override";',
    );

    const matches = await scanForForbiddenStrings(dir, [
      'aramakisai_phase_override',
    ]);

    expect(matches).toEqual([
      {
        file: path.join(dir, 'chunks', 'app.js'),
        forbidden: 'aramakisai_phase_override',
      },
    ]);
  });

  it('returns no matches when the output is clean', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-build-artifacts-test-'));
    await writeFile(path.join(dir, 'app.js'), 'const x = 1;');

    const matches = await scanForForbiddenStrings(dir, [
      'aramakisai_phase_override',
    ]);

    expect(matches).toEqual([]);
  });
});
