import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  deployWithCpuLimitFallback,
  isCpuLimitUnsupported,
  makeFallbackConfigFile,
  stripLimitsTable,
} from './deploy-with-cpu-limit-fallback';

const COMMAND = ['wrangler', 'deploy'];
const FREE_PLAN_ERROR = {
  code: 1,
  output: 'CPU limits are not supported for the Free plan ... [code: 100328]',
};

function setup(results: { code: number; output: string }[]) {
  const run = vi.fn();
  for (const r of results) run.mockResolvedValueOnce(r);
  const cleanup = vi.fn();
  const makeFallbackConfig = vi.fn(() => ({ path: '/tmp/x.toml', cleanup }));
  const warn = vi.fn();
  return { run, cleanup, makeFallbackConfig, warn };
}

describe('deployWithCpuLimitFallback', () => {
  it('reruns once without limits when the Free plan rejects cpu_ms', async () => {
    const s = setup([FREE_PLAN_ERROR, { code: 0, output: 'ok' }]);

    const code = await deployWithCpuLimitFallback({ command: COMMAND, ...s });

    expect(code).toBe(0);
    expect(s.run).toHaveBeenCalledTimes(2);
    expect(s.run).toHaveBeenLastCalledWith([
      ...COMMAND,
      '--config',
      '/tmp/x.toml',
    ]);
    expect(s.warn).toHaveBeenCalledWith(expect.stringMatching(/^::warning::/));
    expect(s.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not rerun a second time when the rerun also fails', async () => {
    const s = setup([FREE_PLAN_ERROR, FREE_PLAN_ERROR]);

    const code = await deployWithCpuLimitFallback({ command: COMMAND, ...s });

    expect(code).toBe(1);
    expect(s.run).toHaveBeenCalledTimes(2);
  });

  it('fails as-is on any other error', async () => {
    const s = setup([
      { code: 7, output: 'Authentication error [code: 10000]' },
    ]);

    const code = await deployWithCpuLimitFallback({ command: COMMAND, ...s });

    expect(code).toBe(7);
    expect(s.run).toHaveBeenCalledTimes(1);
    expect(s.makeFallbackConfig).not.toHaveBeenCalled();
    expect(s.warn).not.toHaveBeenCalled();
  });

  it('does not rerun on success', async () => {
    const s = setup([{ code: 0, output: 'Deployed' }]);

    const code = await deployWithCpuLimitFallback({ command: COMMAND, ...s });

    expect(code).toBe(0);
    expect(s.run).toHaveBeenCalledTimes(1);
    expect(s.makeFallbackConfig).not.toHaveBeenCalled();
  });
});

describe('isCpuLimitUnsupported', () => {
  it('matches the error code and the message', () => {
    expect(isCpuLimitUnsupported('... [code: 100328]')).toBe(true);
    expect(isCpuLimitUnsupported('CPU limits are not supported')).toBe(true);
    expect(isCpuLimitUnsupported('[code: 10000]')).toBe(false);
  });
});

describe('stripLimitsTable', () => {
  it('removes only the [limits] table', () => {
    const toml =
      'name = "a"\n\n[limits]\ncpu_ms = 5000\n\n[assets]\ndirectory = "d"\n';
    expect(stripLimitsTable(toml)).toBe(
      'name = "a"\n\n[assets]\ndirectory = "d"\n',
    );
  });

  it('removes a [limits] table at the end of the file', () => {
    expect(stripLimitsTable('name = "a"\n[limits]\ncpu_ms = 1\n')).toBe(
      'name = "a"\n',
    );
  });
});

describe('makeFallbackConfigFile', () => {
  it('writes the stripped copy next to the original and removes it on cleanup', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'wrangler-'));
    const original = path.join(dir, 'wrangler.toml');
    writeFileSync(original, 'name = "a"\n[limits]\ncpu_ms = 5000\n');

    const fallback = makeFallbackConfigFile(original);

    expect(path.dirname(fallback.path)).toBe(dir);
    expect(readFileSync(fallback.path, 'utf-8')).toBe('name = "a"\n');
    fallback.cleanup();
    expect(existsSync(fallback.path)).toBe(false);
  });

  it('throws when there is no [limits] to remove', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'wrangler-'));
    const original = path.join(dir, 'wrangler.toml');
    writeFileSync(original, 'name = "a"\n');

    expect(() => makeFallbackConfigFile(original)).toThrow();
  });
});
