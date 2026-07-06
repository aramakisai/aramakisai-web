import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/additive-schema-check.yml',
);

type Step = {
  name?: string;
  id?: string;
  run?: string;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  'working-directory'?: string;
};

type Job = {
  name?: string;
  'runs-on'?: string;
  permissions?: Record<string, string>;
  steps: Step[];
};

type Workflow = {
  on: {
    pull_request?: { types?: string[]; paths?: string[] };
  };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

function loadWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW_PATH, 'utf-8'));
}

function allSteps(workflow: Workflow): Step[] {
  return Object.values(workflow.jobs).flatMap((job) => job.steps);
}

function findStep(workflow: Workflow, predicate: (s: Step) => boolean): Step {
  const step = allSteps(workflow).find(predicate);
  expect(step).toBeDefined();
  return step as Step;
}

describe('.github/workflows/additive-schema-check.yml — 7.1 trigger/gate/invocation structure', () => {
  it('triggers on opened/synchronize/reopened for snapshot.yaml only', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.pull_request?.types).toEqual([
      'opened',
      'synchronize',
      'reopened',
    ]);
    expect(workflow.on.pull_request?.paths).toEqual([
      'directus/schema/snapshot.yaml',
    ]);
  });

  it('checks out with full history (fetch-depth: 0) to resolve base/head SHAs', () => {
    const workflow = loadWorkflow();
    const checkout = findStep(
      workflow,
      (s) => s.uses?.startsWith('actions/checkout') === true,
    );
    expect(checkout.with?.['fetch-depth']).toBe(0);
  });

  it('gates every downstream step on the diff result so an unrelated PR does nothing', () => {
    const workflow = loadWorkflow();
    const steps = allSteps(workflow);
    const diffIndex = steps.findIndex((s) => s.id === 'diff');
    expect(diffIndex).toBeGreaterThanOrEqual(0);
    const downstream = steps.slice(diffIndex + 1);
    expect(downstream.length).toBeGreaterThan(0);
    for (const step of downstream) {
      expect(step.if).toMatch(/steps\.diff\.outputs\.changed == 'true'/);
    }
  });

  it('invokes the checker script with two snapshot file arguments (base, head)', () => {
    const workflow = loadWorkflow();
    const runStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('check-additive-schema.ts')),
    );
    expect(runStep.run).toMatch(
      /check-additive-schema\.ts\s+\S*base\S*\s+\S*head\S*/,
    );
  });

  it('references no secrets, so it is safe to run on fork PRs', () => {
    const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(raw).not.toMatch(/secrets\./);
  });

  it('grants no more than read access to the default GITHUB_TOKEN', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions).toEqual({ contents: 'read' });
    for (const job of Object.values(workflow.jobs)) {
      if (job.permissions) {
        expect(job.permissions).toEqual({ contents: 'read' });
      }
    }
  });

  it('has no bypass/override condition that force-succeeds despite a failing check', () => {
    const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(raw).not.toMatch(/labels/i);
    expect(raw).not.toMatch(/override/i);
    expect(raw).not.toMatch(/continue-on-error/i);
    expect(raw).not.toMatch(/always\(\)/);
  });
});
