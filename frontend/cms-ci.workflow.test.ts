import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(__dirname, '../.github/workflows/cms-ci.yml');

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
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  services?: Record<string, unknown>;
  env?: Record<string, unknown>;
  steps: Step[];
};

type Workflow = {
  on: Record<string, { paths?: string[]; branches?: string[] } | null>;
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

function loadWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow;
}

function stepsOf(job: Job): Step[] {
  return job.steps ?? [];
}

function findStep(job: Job, predicate: (step: Step) => boolean): Step {
  const step = stepsOf(job).find(predicate);
  expect(step, 'step not found').toBeDefined();
  return step as Step;
}

describe('cms-ci workflow', () => {
  const workflow = loadWorkflow();

  it('cms/** の変更でのみ発火する', () => {
    expect(workflow.on.pull_request?.paths).toContain('cms/**');
    expect(workflow.on.push?.paths).toEqual(['cms/**']);
    expect(workflow.on.push?.branches).toEqual(['main']);
  });

  it('PR では検証のみを行い、適用系ジョブを走らせない', () => {
    const release = workflow.jobs.release;
    expect(release.if).toContain("github.event_name == 'push'");
    expect(release.needs).toBe('verify');
  });

  it('検証は type-check・テスト・ビルドを含む', () => {
    const verify = workflow.jobs.verify;
    const runs = stepsOf(verify).map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('pnpm type-check'))).toBe(true);
    expect(runs.some((run) => run.includes('pnpm test'))).toBe(true);
    expect(runs.some((run) => run.includes('pnpm build'))).toBe(true);
  });

  it('検証は使い捨ての Postgres に対してマイグレーションを適用する', () => {
    const verify = workflow.jobs.verify;
    expect(Object.keys(verify.services ?? {})).toContain('postgres');
    expect(String(verify.env?.DATABASE_URL)).toContain('localhost:5432');
    findStep(verify, (step) => (step.run ?? '').includes('pnpm migrate'));
  });

  it('生成された型がリポジトリと同期していることを検証する', () => {
    const step = findStep(workflow.jobs.verify, (s) =>
      (s.run ?? '').includes('generate:types'),
    );
    expect(step.run).toContain('git diff --exit-code');
    expect(step.run).toContain('../frontend/src/cms-types.ts');
  });

  it('シークレットは Infisical から取得し .env を作らない', () => {
    const release = workflow.jobs.release;
    const runs = stepsOf(release).map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('infisical login'))).toBe(true);
    expect(runs.every((run) => !run.includes('> .env'))).toBe(true);
    expect(release.env?.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID).toBe(
      '${{ secrets.INFISICAL_CLIENT_ID }}',
    );
  });

  it('イメージをレジストリへ push してから infra のタグを差し替える', () => {
    const release = workflow.jobs.release;
    const steps = stepsOf(release);
    const pushIndex = steps.findIndex((step) =>
      (step.uses ?? '').startsWith('docker/build-push-action'),
    );
    const pinIndex = steps.findIndex((step) =>
      (step.run ?? '').includes('newTag'),
    );
    expect(pushIndex).toBeGreaterThanOrEqual(0);
    expect(pinIndex).toBeGreaterThan(pushIndex);
    expect(release.permissions?.packages).toBe('write');
  });

  it('prod のみへ適用する', () => {
    const step = findStep(workflow.jobs.release, (s) =>
      (s.run ?? '').includes('newTag'),
    );
    expect(step.run).toContain('gitops/manifests/prod/cms/kustomization.yaml');
    expect(step.run).not.toContain('staging');
  });

  it('マイグレーションがデプロイより先に適用されることを PR 本文で明示する', () => {
    const step = findStep(workflow.jobs.release, (s) =>
      (s.run ?? '').includes('gh pr create'),
    );
    expect(step.run).toContain('payload migrate');
    expect(step.run).toContain('マイグレーションはデプロイより先に適用されます');
  });
});
