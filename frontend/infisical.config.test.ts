import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const CONFIG_PATH = path.resolve(__dirname, '.infisical.json');

function isGitIgnored(filePath: string): boolean {
  try {
    // Exit code 0 means git matched an ignore rule for this path.
    execFileSync('git', ['check-ignore', filePath], { stdio: 'pipe' });
    return true;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) return false; // no ignore rule matched
    throw err;
  }
}

describe('frontend/.infisical.json', () => {
  it('is not excluded by .gitignore so CI can commit and read it', () => {
    expect(isGitIgnored(CONFIG_PATH)).toBe(false);
  });

  it('defines a workspaceId and a main -> prod branch mapping', () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(config.workspaceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(config.gitBranchToEnvironmentMapping).toMatchObject({
      main: 'prod',
    });
    expect(config.defaultEnvironment).not.toBe('prod');
  });
});
