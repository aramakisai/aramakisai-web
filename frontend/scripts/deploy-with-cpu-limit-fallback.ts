import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface RunResult {
  code: number;
  output: string;
}

export interface FallbackConfig {
  path: string;
  cleanup: () => void;
}

export interface DeployWithFallbackOptions {
  command: string[];
  run: (command: string[]) => Promise<RunResult>;
  makeFallbackConfig: () => FallbackConfig;
  warn?: (message: string) => void;
}

// Free プランで cpu_ms を付けたときに Cloudflare API が返すエラー。
const CPU_LIMIT_UNSUPPORTED = /100328|CPU limits are not supported/;

export function isCpuLimitUnsupported(output: string): boolean {
  return CPU_LIMIT_UNSUPPORTED.test(output);
}

/** `[limits]` テーブルを次のテーブル見出しの直前まで取り除く。 */
export function stripLimitsTable(toml: string): string {
  return toml.replace(/^\[limits\][^\n]*\n(?:(?!\[)[^\n]*\n?)*/m, '');
}

export async function deployWithCpuLimitFallback(
  options: DeployWithFallbackOptions,
): Promise<number> {
  const { command, run, makeFallbackConfig, warn = console.log } = options;

  const first = await run(command);
  if (first.code === 0 || !isCpuLimitUnsupported(first.output)) {
    return first.code;
  }

  const fallback = makeFallbackConfig();
  try {
    warn(
      '::warning::Free プランのため CPU 上限 (limits.cpu_ms) なしでデプロイを再実行する',
    );
    return (await run([...command, '--config', fallback.path])).code;
  } finally {
    fallback.cleanup();
  }
}

/**
 * wrangler は設定ファイルの置き場所を基準に assets.directory や main を解決するため、
 * 一時ファイルは元の設定と同じディレクトリに置く。
 */
export function makeFallbackConfigFile(configPath: string): FallbackConfig {
  const original = readFileSync(configPath, 'utf-8');
  const stripped = stripLimitsTable(original);
  if (stripped === original) {
    // 取り除けないまま再実行しても同じエラーで落ちるだけなので、原因をここで示す
    throw new Error(`${configPath} に取り除ける [limits] が無い`);
  }
  const tmp = path.join(
    path.dirname(configPath),
    `.wrangler.no-cpu-limit.${randomUUID()}.toml`,
  );
  writeFileSync(tmp, stripped);
  return { path: tmp, cleanup: () => rmSync(tmp, { force: true }) };
}

// 出力は CI ログに流しつつ、失敗理由の判定用に溜める。
function runAndTee(command: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('error', (error) => {
      output += String(error);
      resolve({ code: 1, output });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main(): Promise<void> {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('usage: deploy-with-cpu-limit-fallback.ts <command...>');
    process.exitCode = 1;
    return;
  }
  process.exitCode = await deployWithCpuLimitFallback({
    command,
    run: runAndTee,
    makeFallbackConfig: () => makeFallbackConfigFile('wrangler.toml'),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
