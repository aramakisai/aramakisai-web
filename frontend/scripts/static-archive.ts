import { execFile, execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type Target = 'prod' | 'dev';

export interface ArchiveGeneration {
  readonly sha: string;
  readonly deployedAt: string;
}

export interface ArchiveIndex {
  readonly version: 1;
  readonly generations: readonly ArchiveGeneration[];
}

export type R2GetResult =
  | { readonly kind: 'ok'; readonly path: string }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error'; readonly message: string };

export interface R2 {
  get(key: string, dest: string): Promise<R2GetResult>;
  put(key: string, file: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const RESTORE_CONCURRENCY = 5;

export function archiveKey(target: Target, sha: string): string {
  return `static-archive/${target}/${sha}.tar.gz`;
}

export function indexKey(target: Target): string {
  return `static-archive/${target}/index.json`;
}

export function addGeneration(
  index: ArchiveIndex,
  generation: ArchiveGeneration,
  keep: number,
): {
  readonly next: ArchiveIndex;
  readonly pruned: readonly ArchiveGeneration[];
} {
  const all = [
    generation,
    ...index.generations.filter((g) => g.sha !== generation.sha),
  ];
  return {
    next: { version: 1, generations: all.slice(0, keep) },
    pruned: all.slice(keep),
  };
}

export function classifyR2GetFailure(stderr: string): 'not-found' | 'error' {
  return stderr.includes('The specified key does not exist.')
    ? 'not-found'
    : 'error';
}

function message(error: unknown): string {
  const e = error as { stderr?: unknown; message?: unknown };
  return `${e.stderr ?? ''}${e.message ?? error}`;
}

export function makeWranglerR2(
  bucket: string,
  exec: typeof execFileAsync = execFileAsync,
): R2 {
  const wrangler = (args: string[]) =>
    exec('pnpm', ['exec', 'wrangler', 'r2', 'object', ...args, '--remote'], {
      maxBuffer: 64 * 1024 * 1024,
    });
  return {
    async get(key, dest) {
      try {
        await wrangler(['get', `${bucket}/${key}`, '--file', dest]);
        return { kind: 'ok', path: dest };
      } catch (error) {
        const text = message(error);
        return classifyR2GetFailure(text) === 'not-found'
          ? { kind: 'not-found' }
          : { kind: 'error', message: text };
      }
    },
    async put(key, file) {
      await wrangler(['put', `${bucket}/${key}`, '--file', file]);
    },
    async delete(key) {
      await wrangler(['delete', `${bucket}/${key}`]);
    },
  };
}

function countFiles(dir: string): number {
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter(
    (e) => e.isFile(),
  ).length;
}

function summary(lines: string[]): void {
  for (const line of lines) console.log(line);
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, lines.map((l) => `${l}\n`).join(''));
}

type Warn = (message: string) => void;

async function readIndex(
  r2: R2,
  target: Target,
  work: string,
): Promise<ArchiveIndex> {
  const key = indexKey(target);
  const res = await r2.get(key, path.join(work, 'index.json'));
  if (res.kind === 'not-found') return { version: 1, generations: [] };
  if (res.kind === 'error')
    throw new Error(`r2 get ${key} failed: ${res.message}`);
  try {
    const parsed = JSON.parse(readFileSync(res.path, 'utf-8')) as ArchiveIndex;
    if (parsed.version !== 1 || !Array.isArray(parsed.generations)) {
      throw new Error('unexpected shape');
    }
    return parsed;
  } catch (error) {
    throw new Error(`index ${key} is invalid: ${message(error)}`);
  }
}

export function pack(dir: string, out: string): void {
  execFileSync('tar', ['-czf', out, '-C', dir, '.']);
}

export async function upload(opts: {
  r2: R2;
  target: Target;
  sha: string;
  archive: string;
}): Promise<void> {
  const key = archiveKey(opts.target, opts.sha);
  try {
    await opts.r2.put(key, opts.archive);
  } catch (error) {
    throw new Error(`r2 put ${key} failed: ${message(error)}`);
  }
  summary([`static-archive upload: ${key}`]);
}

export async function restore(opts: {
  r2: R2;
  target: Target;
  dir: string;
  warn?: Warn;
}): Promise<{ generations: number; files: number }> {
  const { r2, target, dir, warn = console.log } = opts;
  const work = mkdtempSync(path.join(os.tmpdir(), 'static-archive-'));
  try {
    const index = await readIndex(r2, target, work);
    const fetched: R2GetResult[] = new Array(index.generations.length);
    let next = 0;
    // 展開は新しい順に直列で行うので、取得だけを並列にする
    const worker = async () => {
      while (next < index.generations.length) {
        const i = next++;
        const key = archiveKey(target, index.generations[i].sha);
        fetched[i] = await r2.get(key, path.join(work, `${i}.tar.gz`));
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(RESTORE_CONCURRENCY, index.generations.length) },
        worker,
      ),
    );

    const before = countFiles(dir);
    let generations = 0;
    for (let i = 0; i < fetched.length; i++) {
      const key = archiveKey(target, index.generations[i].sha);
      const res = fetched[i];
      if (res.kind === 'not-found') {
        warn(`::warning::${key} が無いため飛ばす`);
        continue;
      }
      if (res.kind === 'error')
        throw new Error(`r2 get ${key} failed: ${res.message}`);
      try {
        execFileSync('tar', ['-xzf', res.path, '-C', dir, '--skip-old-files'], {
          stdio: 'pipe',
        });
      } catch (error) {
        throw new Error(`tar extract of ${key} failed: ${message(error)}`);
      }
      generations++;
    }
    const files = countFiles(dir) - before;
    summary([
      `static-archive restore (${target}): ${generations} generations, ${files} files added`,
    ]);
    return { generations, files };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function publish(opts: {
  r2: R2;
  target: Target;
  sha: string;
  keep: number;
  now?: () => Date;
  warn?: Warn;
}): Promise<{ generations: number; pruned: number }> {
  const {
    r2,
    target,
    sha,
    keep,
    now = () => new Date(),
    warn = console.log,
  } = opts;
  const work = mkdtempSync(path.join(os.tmpdir(), 'static-archive-'));
  try {
    const current = await readIndex(r2, target, work);
    const { next, pruned } = addGeneration(
      current,
      { sha, deployedAt: now().toISOString() },
      keep,
    );
    const file = path.join(work, 'next-index.json');
    writeFileSync(file, JSON.stringify(next));
    const key = indexKey(target);
    try {
      await r2.put(key, file);
    } catch (error) {
      throw new Error(`r2 put ${key} failed: ${message(error)}`);
    }
    for (const g of pruned) {
      const tarKey = archiveKey(target, g.sha);
      try {
        await r2.delete(tarKey);
      } catch (error) {
        warn(`::warning::r2 delete ${tarKey} failed: ${message(error)}`);
      }
    }
    summary([
      `static-archive publish (${target}): ${next.generations.length} generations, ${pruned.length} pruned`,
    ]);
    return { generations: next.generations.length, pruned: pruned.length };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export type Command =
  | { command: 'pack'; dir: string; out: string }
  | {
      command: 'upload';
      bucket: string;
      target: Target;
      sha: string;
      archive: string;
    }
  | { command: 'restore'; bucket: string; target: Target; dir: string }
  | {
      command: 'publish';
      bucket: string;
      target: Target;
      sha: string;
      keep: number;
    };

const REQUIRED: Record<Command['command'], string[]> = {
  pack: ['dir', 'out'],
  upload: ['bucket', 'target', 'sha', 'archive'],
  restore: ['bucket', 'target', 'dir'],
  publish: ['bucket', 'target', 'sha', 'keep'],
};

export function parseArgs(argv: string[]): Command {
  const [command, ...rest] = argv;
  if (!(command in REQUIRED)) throw new Error(`unknown command: ${command}`);
  const values: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--') || rest[i + 1] === undefined) {
      throw new Error(`invalid argument: ${rest[i]}`);
    }
    values[rest[i].slice(2)] = rest[i + 1];
  }
  for (const name of REQUIRED[command as Command['command']]) {
    if (!values[name]) throw new Error(`missing --${name}`);
  }
  if (
    values.target !== undefined &&
    values.target !== 'prod' &&
    values.target !== 'dev'
  ) {
    throw new Error(`invalid --target: ${values.target}`);
  }
  if (values.keep !== undefined && !/^[1-9]\d*$/.test(values.keep)) {
    throw new Error(`invalid --keep: ${values.keep}`);
  }
  return {
    ...values,
    command,
    ...(values.keep !== undefined && { keep: Number(values.keep) }),
  } as Command;
}

async function main(): Promise<void> {
  let cmd: Command;
  try {
    cmd = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`::error::${message(error)}`);
    process.exitCode = 2;
    return;
  }
  try {
    switch (cmd.command) {
      case 'pack':
        pack(cmd.dir, cmd.out);
        break;
      case 'upload':
        await upload({ ...cmd, r2: makeWranglerR2(cmd.bucket) });
        break;
      case 'restore':
        await restore({ ...cmd, r2: makeWranglerR2(cmd.bucket) });
        break;
      case 'publish':
        await publish({ ...cmd, r2: makeWranglerR2(cmd.bucket) });
        break;
    }
  } catch (error) {
    console.error(`::error::${message(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
