import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const DUMMY_PATH = path.resolve(
  __dirname,
  '../.github/workflows/additive-schema-check-dummy.yml',
);
const REAL_PATH = path.resolve(
  __dirname,
  '../.github/workflows/additive-schema-check.yml',
);

type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  steps: { run?: string }[];
};

type Workflow = {
  on: { pull_request?: { branches?: string[]; paths?: string[] } };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

function loadWorkflow(p: string): Workflow {
  return parse(readFileSync(p, 'utf-8'));
}

// ci-pipeline-audit タスク3: additive-schema-check.yml が required status check
// 化された際、directus/schema/snapshot.yaml を触らない PR で該当 context が
// 永久 pending にならないよう、frontend-ci-dummy.yml と同型の回避策を複製する。
describe('.github/workflows/additive-schema-check-dummy.yml', () => {
  it('triggers on every PR to main with no path filter (inverse of additive-schema-check.yml)', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    expect(dummy.on.pull_request?.branches).toEqual(['main']);
    expect(dummy.on.pull_request?.paths).toBeUndefined();
  });

  it('reports the exact same required context name as additive-schema-check.yml', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    const real = loadWorkflow(REAL_PATH);
    const dummyNames = Object.values(dummy.jobs)
      .map((j) => j.name)
      .filter(Boolean);
    expect(dummyNames).toContain('Detect breaking snapshot.yaml changes');
    const realNames = Object.values(real.jobs)
      .map((j) => j.name)
      .filter(Boolean);
    expect(realNames).toContain('Detect breaking snapshot.yaml changes');
  });

  it('skips the dummy check job when snapshot.yaml actually changed', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    const check = dummy.jobs.check;
    expect(check).toBeDefined();
    expect(check.if).toMatch(/needs\.detect\.outputs\.changed == 'false'/);
    expect([check.needs].flat()).toContain('detect');
  });

  it('detects directus/schema/snapshot.yaml changes via base/head diff', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    const detectStep = dummy.jobs.detect.steps.find((s) =>
      Boolean(s.run?.includes('git diff --name-only')),
    );
    expect(detectStep).toBeDefined();
    expect(detectStep?.run).toContain('directus/schema/snapshot.yaml');
  });

  it('references no secrets, so it is safe to run on fork PRs', () => {
    const raw = readFileSync(DUMMY_PATH, 'utf-8');
    expect(raw).not.toMatch(/secrets\./);
  });

  it('only reads repo contents, no elevated permissions', () => {
    const dummy = loadWorkflow(DUMMY_PATH);
    expect(dummy.permissions).toEqual({ contents: 'read' });
    for (const job of Object.values(dummy.jobs)) {
      if (job.permissions) {
        expect(job.permissions).toEqual({ contents: 'read' });
      }
    }
  });
});
