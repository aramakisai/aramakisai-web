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
  id?: string;
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
  permissions?: Record<string, string>;
  steps: Step[];
};

type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  defaults?: { run?: { 'working-directory'?: string } };
  jobs: Record<string, Job>;
};

function loadWorkflow(): Workflow {
  return parse(readFileSync(WORKFLOW_PATH, 'utf-8'));
}

function runCommands(job: Job): string[] {
  return job.steps.filter((s) => s.run).map((s) => s.run as string);
}

function needsArray(job: Job): string[] {
  if (!job.needs) return [];
  return Array.isArray(job.needs) ? job.needs : [job.needs];
}

describe('.github/workflows/frontend-ci.yml — deploy-preview job', () => {
  it('depends on validate so it never runs when type-check/build fails', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    expect(job).toBeDefined();
    expect(needsArray(job)).toContain('validate');
  });

  it('only runs for non-fork pull requests', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    expect(job.if).toMatch(/pull_request/);
    expect(job.if).toMatch(/head\.repo\.fork == false/);
  });

  it('builds with Infisical staging env before uploading a Workers version', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    const commands = runCommands(job);

    const buildIdx = commands.findIndex((c) =>
      c.includes(
        'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=staging -- pnpm exec opennextjs-cloudflare build',
      ),
    );
    const uploadIdx = commands.findIndex((c) =>
      c.includes('wrangler versions upload'),
    );

    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(uploadIdx).toBeGreaterThan(buildIdx);
  });

  it('does not run wrangler deploy (prod traffic must stay untouched)', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    const commands = runCommands(job).join('\n');
    expect(commands).not.toMatch(/opennextjs-cloudflare deploy/);
    expect(commands).not.toMatch(/wrangler deploy/);
  });

  it('posts the preview URL as a PR comment', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    const usesUpsertComment = job.steps.some(
      (s) =>
        s.uses?.startsWith('peter-evans/create-or-update-comment') ||
        s.uses?.startsWith('peter-evans/find-comment'),
    );
    expect(usesUpsertComment).toBe(true);
    expect(job.permissions).toMatchObject({ 'pull-requests': 'write' });
  });
});

describe('.github/workflows/frontend-ci.yml — deploy-prod job', () => {
  it('depends on validate so it never runs when type-check/build fails', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-prod'];
    expect(job).toBeDefined();
    expect(needsArray(job)).toContain('validate');
  });

  it('only runs on push to main', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-prod'];
    expect(job.if).toMatch(/github\.event_name == 'push'/);
    expect(job.if).toMatch(/refs\/heads\/main/);
  });

  it('builds and deploys with the Infisical prod env', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-prod'];
    const commands = runCommands(job);

    const buildIdx = commands.findIndex((c) =>
      c.includes(
        'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=prod -- pnpm exec opennextjs-cloudflare build',
      ),
    );
    const deployIdx = commands.findIndex((c) =>
      c.includes(
        'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=prod -- pnpm exec opennextjs-cloudflare deploy',
      ),
    );

    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThan(buildIdx);
  });
});

describe('.github/workflows/frontend-ci.yml — secret exposure', () => {
  it('only ever references the two Infisical machine-identity GH secrets', () => {
    const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
    const referenced = [...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const allowed = new Set(['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']);
    for (const name of referenced) {
      expect(allowed.has(name)).toBe(true);
    }
  });

  it('never grants secrets to fork PR jobs', () => {
    const workflow = loadWorkflow();
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const usesSecrets = JSON.stringify(job).includes('secrets.INFISICAL_');
      if (usesSecrets && name !== 'deploy-prod' && name !== 'deploy-dev') {
        expect(job.if).toMatch(/head\.repo\.fork == false/);
      }
    }
  });
});
