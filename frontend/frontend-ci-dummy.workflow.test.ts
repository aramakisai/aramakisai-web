import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const DUMMY_PATH = path.resolve(
  __dirname,
  '../.github/workflows/frontend-ci-dummy.yml',
);
const REAL_PATH = path.resolve(
  __dirname,
  '../.github/workflows/frontend-ci.yml',
);

type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  steps: { run?: string }[];
};

type Workflow = {
  on: { pull_request?: { branches?: string[]; paths?: string[] } };
  jobs: Record<string, Job>;
};

function loadWorkflow(p: string): Workflow {
  return parse(readFileSync(p, 'utf-8'));
}

// repo-governance タスク6.3.1: frontend/** を触らない PR でも
// branch protection の required status checks が完了報告されるようにする
// (research.md #3 の GitHub 既知制約への対応)。
describe('.github/workflows/frontend-ci-dummy.yml', () => {
  it('triggers on every PR to main with no path filter (inverse of frontend-ci.yml)', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    expect(dummy.on.pull_request?.branches).toEqual(['main']);
    expect(dummy.on.pull_request?.paths).toBeUndefined();
  });

  it('reports the exact same required context names as frontend-ci.yml', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    const real = loadWorkflow(REAL_PATH);
    const dummyNames = Object.values(dummy.jobs)
      .map((j) => j.name)
      .filter(Boolean);
    expect(dummyNames).toContain('type-check / lint / test / build');
    expect(dummyNames).toContain('deploy preview (Workers)');
    expect(dummyNames).toContain('e2e (staging preview)');
    const realNames = Object.values(real.jobs)
      .map((j) => j.name)
      .filter(Boolean);
    expect(realNames).toContain('type-check / lint / test / build');
    expect(realNames).toContain('deploy preview (Workers)');
    expect(realNames).toContain('e2e (staging preview)');
  });

  it('skips the dummy validate/deploy-preview/e2e jobs when frontend/** actually changed', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    for (const name of ['validate', 'deploy-preview', 'e2e']) {
      const job = dummy.jobs[name];
      expect(job).toBeDefined();
      expect(job.if).toMatch(/needs\.detect\.outputs\.changed == 'false'/);
      expect([job.needs].flat()).toContain('detect');
    }
  });

  it('detects frontend/** and frontend-ci.yml changes via base/head diff', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    const detectStep = dummy.jobs.detect.steps.find((s) =>
      Boolean(s.run?.includes('git diff --name-only')),
    );
    expect(detectStep).toBeDefined();
    expect(detectStep?.run).toContain('frontend/');
    expect(detectStep?.run).toContain('.github/workflows/frontend-ci');
  });

  it('only reads repo contents, no elevated permissions', () => {
    const raw = readFileSync(DUMMY_PATH, 'utf-8');
    expect(raw).toMatch(/permissions:\s*\n\s*contents: read/);
  });
});
