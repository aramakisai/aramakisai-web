import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/frontend-ci.yml',
);

type Step = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
};

type Job = {
  name?: string;
  'runs-on'?: string;
  if?: string;
  needs?: string | string[];
  steps: Step[];
};

type Workflow = {
  on: {
    pull_request?: { types?: string[]; branches?: string[]; paths?: string[] };
    push?: { branches?: string[]; paths?: string[] };
  };
  permissions?: Record<string, string>;
  defaults?: { run?: { 'working-directory'?: string } };
  jobs: Record<string, Job>;
};

function loadWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW_PATH, 'utf-8'));
}

function allSteps(workflow: Workflow): Step[] {
  return Object.values(workflow.jobs).flatMap((job) => job.steps);
}

describe('.github/workflows/frontend-ci.yml', () => {
  it('triggers on PR open/synchronize/reopen against main', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.pull_request?.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened']),
    );
    expect(workflow.on.pull_request?.branches).toEqual(['main']);
  });

  it('triggers on push to main and dev', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.push?.branches).toEqual(['main', 'dev']);
  });

  it('runs steps in the frontend working directory', () => {
    const workflow = loadWorkflow();
    expect(workflow.defaults?.run?.['working-directory']).toBe('frontend');
  });

  it('installs with a frozen lockfile then runs type-check, lint, format:check, test, build in order', () => {
    const workflow = loadWorkflow();
    const steps = allSteps(workflow);
    const runCommands = steps.filter((s) => s.run).map((s) => s.run);

    const indices = [
      'pnpm install --frozen-lockfile',
      'pnpm type-check',
      'pnpm lint',
      'pnpm format:check',
      'pnpm test',
      'pnpm build',
    ].map((cmd) => runCommands.indexOf(cmd));

    expect(indices).not.toContain(-1);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  it('builds with dummy NEXT_PUBLIC_* env so the build runs on fork PRs too', () => {
    const workflow = loadWorkflow();
    const buildStep = allSteps(workflow).find((s) => s.run === 'pnpm build');
    expect(buildStep?.env).toMatchObject({
      NEXT_PUBLIC_DIRECTUS_URL: expect.any(String),
      NEXT_PUBLIC_SITE_URL: expect.any(String),
    });
  });

  it('caches the pnpm store and .next/cache between runs', () => {
    const workflow = loadWorkflow();
    const steps = allSteps(workflow);

    const setupNode = steps.find((s) =>
      s.uses?.startsWith('actions/setup-node'),
    );
    expect(setupNode?.with?.cache).toBe('pnpm');

    const nextCache = steps.find(
      (s) =>
        s.uses?.startsWith('actions/cache') &&
        s.with?.path === 'frontend/.next/cache',
    );
    expect(nextCache).toBeDefined();
  });

  it('grants no more than read access to the default GITHUB_TOKEN', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('never references repository secrets in validate, so fork PRs never see them', () => {
    const workflow = loadWorkflow();
    const validateSteps = JSON.stringify(workflow.jobs.validate.steps);
    expect(validateSteps).not.toMatch(/secrets\.[A-Z]/);
  });

  it('runs e2e staging preview job after deploy-preview is successful', () => {
    const workflow = loadWorkflow();
    const e2eJob = workflow.jobs.e2e;
    expect(e2eJob).toBeDefined();
    expect(e2eJob.name).toBe('e2e (staging preview)');
    expect([e2eJob.needs].flat()).toContain('deploy-preview');
  });

  it('runs deploy-dev job on push to dev branch', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-dev'];
    expect(job).toBeDefined();
    expect(job.name).toBe('deploy dev (Workers)');
    expect(job.if).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/dev'",
    );
    expect(job.needs).toBe('validate');

    // Check it uses staging infisical, not prod
    const deployStep = job.steps.find(
      (s) => s.name === 'Deploy to Cloudflare Workers (dev)',
    );
    expect(deployStep?.run).toContain('--env=staging');
    expect(deployStep?.run).toContain('wrangler deploy --env=dev');
  });
});
