import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  addGeneration,
  archiveKey,
  classifyR2GetFailure,
  indexKey,
  makeWranglerR2,
  pack,
  parseArgs,
  publish,
  restore,
  upload,
  type ArchiveIndex,
  type R2,
  type R2GetResult,
} from './static-archive';

const gen = (sha: string) => ({ sha, deployedAt: '2026-01-01T00:00:00Z' });
const idx = (...shas: string[]): ArchiveIndex => ({
  version: 1,
  generations: shas.map(gen),
});

function tmp(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'static-archive-test-'));
}

function write(file: string, body: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function makeTar(files: Record<string, string>): string {
  const src = tmp();
  for (const [name, body] of Object.entries(files))
    write(path.join(src, name), body);
  const out = path.join(tmp(), 'a.tar.gz');
  execFileSync('tar', ['-czf', out, '-C', src, '.']);
  return out;
}

interface FakeOpts {
  objects?: Record<string, string | { tar: string } | 'error'>;
  putError?: string;
  deleteError?: string;
}

function fakeR2(opts: FakeOpts = {}) {
  const objects = opts.objects ?? {};
  const puts: { key: string; body: string }[] = [];
  const deletes: string[] = [];
  const r2: R2 = {
    async get(key, dest): Promise<R2GetResult> {
      const o = objects[key];
      if (o === undefined) return { kind: 'not-found' };
      if (o === 'error') return { kind: 'error', message: 'boom' };
      if (typeof o === 'string') writeFileSync(dest, o);
      else writeFileSync(dest, readFileSync(o.tar));
      return { kind: 'ok', path: dest };
    },
    async put(key, file) {
      if (opts.putError) throw new Error(opts.putError);
      puts.push({ key, body: readFileSync(file, 'utf-8') });
    },
    async delete(key) {
      if (opts.deleteError) throw new Error(opts.deleteError);
      deletes.push(key);
    },
  };
  return { r2, puts, deletes };
}

describe('keys', () => {
  it('builds keys under static-archive/<target>/', () => {
    expect(archiveKey('prod', 'abc')).toBe('static-archive/prod/abc.tar.gz');
    expect(indexKey('dev')).toBe('static-archive/dev/index.json');
  });
});

describe('addGeneration', () => {
  it('prepends the new generation', () => {
    const { next, pruned } = addGeneration(idx('b', 'a'), gen('c'), 5);
    expect(next.generations.map((g) => g.sha)).toEqual(['c', 'b', 'a']);
    expect(pruned).toEqual([]);
  });

  it('prunes the tail beyond keep', () => {
    const { next, pruned } = addGeneration(idx('c', 'b', 'a'), gen('d'), 2);
    expect(next.generations.map((g) => g.sha)).toEqual(['d', 'c']);
    expect(pruned.map((g) => g.sha)).toEqual(['b', 'a']);
  });

  it('moves a re-registered sha to the head without duplicating', () => {
    const { next, pruned } = addGeneration(idx('c', 'b', 'a'), gen('b'), 5);
    expect(next.generations.map((g) => g.sha)).toEqual(['b', 'c', 'a']);
    expect(pruned).toEqual([]);
  });
});

describe('classifyR2GetFailure', () => {
  it('detects missing keys only by the wrangler message', () => {
    expect(
      classifyR2GetFailure('X [ERROR] The specified key does not exist.'),
    ).toBe('not-found');
    expect(classifyR2GetFailure('Authentication error [code: 10000]')).toBe(
      'error',
    );
  });
});

describe('parseArgs', () => {
  it('rejects an unknown target', () => {
    expect(() =>
      parseArgs([
        'publish',
        '--bucket',
        'b',
        '--target',
        'preview',
        '--sha',
        's',
        '--keep',
        '1',
      ]),
    ).toThrow(/target/);
  });
  it('rejects a non-positive or non-integer keep', () => {
    for (const keep of ['0', '-1', '1.5', 'x']) {
      expect(() =>
        parseArgs([
          'publish',
          '--bucket',
          'b',
          '--target',
          'prod',
          '--sha',
          's',
          '--keep',
          keep,
        ]),
      ).toThrow(/keep/);
    }
  });
  it('accepts valid publish arguments', () => {
    expect(
      parseArgs([
        'publish',
        '--bucket',
        'b',
        '--target',
        'dev',
        '--sha',
        's',
        '--keep',
        '20',
      ]),
    ).toMatchObject({ command: 'publish', target: 'dev', keep: 20 });
  });
});

describe('pack', () => {
  it('stores the directory contents with relative paths', () => {
    const dir = tmp();
    write(path.join(dir, 'chunks/a.js'), 'A');
    const out = path.join(tmp(), 'cur.tar.gz');
    pack(dir, out);
    const list = execFileSync('tar', ['-tzf', out]).toString();
    expect(list).toMatch(/(^|\n)(\.\/)?chunks\/a\.js\n/);
  });
});

describe('upload', () => {
  it('puts the archive at the sha key', async () => {
    const { r2 } = fakeR2();
    const spy = vi.spyOn(r2, 'put');
    const file = path.join(tmp(), 'cur.tar.gz');
    writeFileSync(file, 'x');
    await upload({ r2, target: 'prod', sha: 'abc', archive: file });
    expect(spy).toHaveBeenCalledWith('static-archive/prod/abc.tar.gz', file);
  });
  it('fails when put fails', async () => {
    const { r2 } = fakeR2({ putError: 'denied' });
    await expect(
      upload({ r2, target: 'prod', sha: 'abc', archive: '/nonexistent' }),
    ).rejects.toThrow(/denied/);
  });
});

describe('restore', () => {
  const indexBody = (...shas: string[]) => JSON.stringify(idx(...shas));

  it('succeeds with no generations when the index is missing', async () => {
    const { r2 } = fakeR2();
    const dir = tmp();
    const r = await restore({ r2, target: 'prod', dir });
    expect(r.generations).toBe(0);
  });

  it('adds files only present in old generations and never overwrites existing ones', async () => {
    const dir = tmp();
    write(path.join(dir, 'chunks/same.js'), 'CURRENT');
    const { r2 } = fakeR2({
      objects: {
        [indexKey('prod')]: indexBody('new', 'old'),
        [archiveKey('prod', 'new')]: {
          tar: makeTar({
            'chunks/same.js': 'NEW-GEN',
            'chunks/new-only.js': 'N',
          }),
        },
        [archiveKey('prod', 'old')]: {
          tar: makeTar({
            'chunks/same.js': 'OLD-GEN',
            'chunks/old-only.js': 'O',
          }),
        },
      },
    });
    const r = await restore({ r2, target: 'prod', dir });
    expect(readFileSync(path.join(dir, 'chunks/same.js'), 'utf-8')).toBe(
      'CURRENT',
    );
    expect(readFileSync(path.join(dir, 'chunks/new-only.js'), 'utf-8')).toBe(
      'N',
    );
    expect(readFileSync(path.join(dir, 'chunks/old-only.js'), 'utf-8')).toBe(
      'O',
    );
    expect(r).toMatchObject({ generations: 2, files: 2 });
  });

  it('prefers the newer generation when two old generations share a file name', async () => {
    const dir = tmp();
    const { r2 } = fakeR2({
      objects: {
        [indexKey('prod')]: indexBody('new', 'old'),
        [archiveKey('prod', 'new')]: { tar: makeTar({ 'x.js': 'NEW' }) },
        [archiveKey('prod', 'old')]: { tar: makeTar({ 'x.js': 'OLD' }) },
      },
    });
    await restore({ r2, target: 'prod', dir });
    expect(readFileSync(path.join(dir, 'x.js'), 'utf-8')).toBe('NEW');
  });

  it('warns and skips a generation whose tar is missing', async () => {
    const dir = tmp();
    const warn = vi.fn();
    const { r2 } = fakeR2({
      objects: {
        [indexKey('prod')]: indexBody('gone', 'ok'),
        [archiveKey('prod', 'ok')]: { tar: makeTar({ 'a.js': 'A' }) },
      },
    });
    const r = await restore({ r2, target: 'prod', dir, warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('::warning::'));
    expect(existsSync(path.join(dir, 'a.js'))).toBe(true);
    expect(r.generations).toBe(1);
  });

  it('fails when the index get errors', async () => {
    const { r2 } = fakeR2({ objects: { [indexKey('prod')]: 'error' } });
    await expect(restore({ r2, target: 'prod', dir: tmp() })).rejects.toThrow(
      indexKey('prod'),
    );
  });

  it('fails when the index is not valid JSON', async () => {
    const { r2 } = fakeR2({ objects: { [indexKey('prod')]: '{not json' } });
    await expect(restore({ r2, target: 'prod', dir: tmp() })).rejects.toThrow(
      /index/,
    );
  });

  it('fails when a tar get errors', async () => {
    const { r2 } = fakeR2({
      objects: {
        [indexKey('prod')]: indexBody('a'),
        [archiveKey('prod', 'a')]: 'error',
      },
    });
    await expect(restore({ r2, target: 'prod', dir: tmp() })).rejects.toThrow(
      archiveKey('prod', 'a'),
    );
  });

  it('fails when extraction fails', async () => {
    const { r2 } = fakeR2({
      objects: {
        [indexKey('prod')]: indexBody('a'),
        [archiveKey('prod', 'a')]: 'not a tar',
      },
    });
    await expect(restore({ r2, target: 'prod', dir: tmp() })).rejects.toThrow(
      /tar/,
    );
  });

  it('fetches at most 5 generations concurrently', async () => {
    const shas = Array.from({ length: 12 }, (_, i) => `g${i}`);
    const objects: Record<string, string | { tar: string }> = {
      [indexKey('prod')]: indexBody(...shas),
    };
    const t = makeTar({ 'a.js': 'A' });
    for (const s of shas) objects[archiveKey('prod', s)] = { tar: t };
    const base = fakeR2({ objects }).r2;
    let active = 0;
    let max = 0;
    const r2: R2 = {
      ...base,
      async get(key, dest) {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 5));
        const res = await base.get(key, dest);
        active--;
        return res;
      },
    };
    await restore({ r2, target: 'prod', dir: tmp() });
    expect(max).toBeLessThanOrEqual(5);
    expect(max).toBeGreaterThan(1);
  });
});

describe('publish', () => {
  const now = () => new Date('2026-02-03T04:05:06Z');

  it('starts from an empty index when none exists and puts the new index', async () => {
    const { r2, puts, deletes } = fakeR2();
    const r = await publish({ r2, target: 'dev', sha: 'a', keep: 3, now });
    expect(JSON.parse(puts[0].body)).toEqual({
      version: 1,
      generations: [{ sha: 'a', deployedAt: '2026-02-03T04:05:06.000Z' }],
    });
    expect(puts[0]).toMatchObject({ key: 'static-archive/dev/index.json' });
    expect(deletes).toEqual([]);
    expect(r.generations).toBe(1);
  });

  it('puts the index before deleting pruned tars', async () => {
    const order: string[] = [];
    const base = fakeR2({
      objects: { [indexKey('prod')]: JSON.stringify(idx('b', 'a')) },
    }).r2;
    const r2: R2 = {
      ...base,
      async put(k, f) {
        order.push(`put:${k}`);
        return base.put(k, f);
      },
      async delete(k) {
        order.push(`delete:${k}`);
      },
    };
    await publish({ r2, target: 'prod', sha: 'c', keep: 2, now });
    expect(order).toEqual([
      `put:${indexKey('prod')}`,
      `delete:${archiveKey('prod', 'a')}`,
    ]);
  });

  it('only warns when deleting a pruned tar fails', async () => {
    const warn = vi.fn();
    const { r2 } = fakeR2({
      objects: { [indexKey('prod')]: JSON.stringify(idx('a')) },
      deleteError: 'nope',
    });
    await publish({ r2, target: 'prod', sha: 'b', keep: 1, now, warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('::warning::'));
  });

  it('fails when the index put fails', async () => {
    const { r2 } = fakeR2({ putError: 'denied' });
    await expect(
      publish({ r2, target: 'prod', sha: 'a', keep: 1, now }),
    ).rejects.toThrow(/denied/);
  });

  it('fails when the existing index get errors', async () => {
    const { r2 } = fakeR2({ objects: { [indexKey('prod')]: 'error' } });
    await expect(
      publish({ r2, target: 'prod', sha: 'a', keep: 1, now }),
    ).rejects.toThrow(indexKey('prod'));
  });
});

describe('makeWranglerR2.get', () => {
  const run = (exec: (...a: unknown[]) => Promise<unknown>) =>
    makeWranglerR2('b', exec as never).get('k', '/tmp/dest');

  it('stderr に key 不在の文言があれば not-found', async () => {
    const res = await run(async () => {
      throw Object.assign(new Error('failed'), {
        stderr: 'The specified key does not exist.',
      });
    });
    expect(res).toEqual({ kind: 'not-found' });
  });

  it('認証エラー等の別文言は error', async () => {
    const res = await run(async () => {
      throw Object.assign(new Error('failed'), {
        stderr: 'Authentication error [code: 10000]',
      });
    });
    expect(res.kind).toBe('error');
    expect((res as { message: string }).message).toContain(
      'Authentication error',
    );
  });

  it('成功すれば ok', async () => {
    const res = await run(async () => ({ stdout: '', stderr: '' }));
    expect(res).toEqual({ kind: 'ok', path: '/tmp/dest' });
  });
});

describe('CLI exit code', () => {
  const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx');
  const cli = (...args: string[]) => {
    try {
      execFileSync(
        tsx,
        [path.resolve(__dirname, 'static-archive.ts'), ...args],
        {
          stdio: 'pipe',
        },
      );
      return 0;
    } catch (e) {
      return (e as { status: number }).status;
    }
  };

  it('引数不正は 2', () => {
    expect(cli('pack')).toBe(2);
  });

  it('操作失敗は 1', () => {
    const d = tmp();
    expect(
      cli(
        'pack',
        '--dir',
        path.join(d, 'missing'),
        '--out',
        path.join(d, 'o.tgz'),
      ),
    ).toBe(1);
  });
});
