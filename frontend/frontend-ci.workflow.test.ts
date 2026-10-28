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
  env?: Record<string, unknown>;
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
  it('triggers on PR open/synchronize/reopen against main and dev', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.pull_request?.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened']),
    );
    expect(workflow.on.pull_request?.branches).toEqual(['main', 'dev']);
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
      NEXT_PUBLIC_CMS_URL: expect.any(String),
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

  it('runs local fixture E2E in an independent job without preview deployment or secrets', () => {
    const workflow = loadWorkflow();
    const localFixtureJob = workflow.jobs['local-fixture-e2e'];
    expect(localFixtureJob).toBeDefined();
    expect(localFixtureJob.name).toBe('e2e (local fixture)');
    expect([localFixtureJob.needs].flat()).not.toContain('deploy-preview');
    expect(localFixtureJob.env).toMatchObject({
      E2E_LOCAL_APP: '1',
      E2E_BASE_URL: 'http://127.0.0.1:3011',
    });

    const jobJson = JSON.stringify(localFixtureJob);
    expect(jobJson).not.toMatch(/secrets\.|INFISICAL|wrangler|Cloudflare/);
    expect(
      localFixtureJob.steps.some(
        (step) =>
          step.run === "pnpm exec playwright test --grep '@local-fixture'",
      ),
    ).toBe(true);
  });

  it('runs only non-fixture tests against the staging preview', () => {
    const workflow = loadWorkflow();
    const previewCommands = workflow.jobs.e2e.steps
      .filter((step) => step.run)
      .map((step) => step.run);

    expect(previewCommands).toContain(
      'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=staging -- env NEXT_PUBLIC_CMS_URL=https://cms.aramakisai.com pnpm exec playwright test --grep-invert \'@local-fixture\'',
    );
    expect(previewCommands).not.toContain(
      "pnpm exec playwright test --grep '@local-fixture'",
    );
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

  it('injects the phase override flag into deploy-dev and deploy-preview, never validate/e2e/verify-build-artifacts/prod', () => {
    const workflow = loadWorkflow();
    const FLAG_NAME = 'NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE';

    const devBuildStep = workflow.jobs['deploy-dev'].steps.find(
      (s) => s.run === 'pnpm exec opennextjs-cloudflare build',
    );
    expect(devBuildStep?.env).toMatchObject({ [FLAG_NAME]: 'true' });

    const previewBuildStep = workflow.jobs['deploy-preview'].steps.find((s) =>
      s.run?.includes('opennextjs-cloudflare build'),
    );
    expect(previewBuildStep?.run).toContain(`${FLAG_NAME}=true`);

    for (const jobName of [
      'validate',
      'local-fixture-e2e',
      'e2e',
      'verify-build-artifacts',
      'deploy-prod',
    ]) {
      expect(JSON.stringify(workflow.jobs[jobName])).not.toContain(FLAG_NAME);
    }
  });

  it('verifies build artifacts for dev code from a step separate from validate', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['verify-build-artifacts'];
    expect(job).toBeDefined();
    expect([job.needs].flat()).toContain('validate');

    const runCommands = job.steps.filter((s) => s.run).map((s) => s.run);
    expect(runCommands).toContain('pnpm check:build-artifacts');
  });

  it('never registers the phase override flag as a secret reference', () => {
    const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
    const flagLines = raw
      .split('\n')
      .filter((line) => line.includes('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE'));
    expect(flagLines).toHaveLength(2);
    for (const line of flagLines) {
      expect(line).not.toMatch(/secrets\./);
    }
  });

  describe('deploy-prod signage relay', () => {
    const steps = () => loadWorkflow().jobs['deploy-prod'].steps;
    const idx = (name: string) => steps().findIndex((s) => s.name === name);

    it('checks out full history for the path diff', () => {
      const checkout = steps().find((s) =>
        s.uses?.startsWith('actions/checkout'),
      );
      expect(checkout?.with?.['fetch-depth']).toBe(0);
    });

    it('deploys the relay after the site, only when relay paths changed', () => {
      const i = idx('Deploy signage relay to Cloudflare Workers (prod)');
      expect(i).toBeGreaterThan(idx('Deploy to Cloudflare Workers (prod)'));
      const step = steps()[i] as Step & { if?: string };
      expect(step.if).toContain("steps.relay.outputs.changed == 'true'");
      expect(step.run).toContain('-c workers/signage-quake/wrangler.toml');
      expect(step.run).toContain(
        '--secrets-file "$RUNNER_TEMP/quake-secrets.json"',
      );
    });

    it('treats zero/unavailable previous commit as changed', () => {
      const detect = steps().find(
        (s) => s.name === 'Detect signage relay changes',
      );
      expect(detect?.run).toContain('0000000000000000000000000000000000000000');
      expect(detect?.run).toContain('frontend/workers/signage-quake');
      expect(detect?.run).toMatch(/\|\| ! git diff/);
    });

    it('writes the secrets file from Infisical and always removes it', () => {
      const write = steps()[idx('Write signage relay secrets file (prod)')];
      expect(write.run).toContain('SIGNAGE_QUAKE_TOKEN');
      expect(write.run).toContain('DISCORD_QUAKE_WEBHOOK_URL');
      expect(write.run).toContain('--env=prod');
      const rm = steps()[idx('Remove signage relay secrets file')] as Step & {
        if?: string;
      };
      expect(rm.if).toBe('always()');
      expect(rm.run).toContain('quake-secrets.json');
    });
  });
});
