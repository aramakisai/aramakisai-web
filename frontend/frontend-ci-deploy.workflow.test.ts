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
  it('runs in parallel with validate (no needs) to shorten the critical path', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    expect(job).toBeDefined();
    expect(needsArray(job)).not.toContain('validate');
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

    const buildIdx = commands.findIndex(
      (c) =>
        c.includes(
          'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=staging -- env NEXT_PUBLIC_CMS_URL=https://cms.aramakisai.com',
        ) && c.includes('pnpm exec opennextjs-cloudflare build'),
    );
    const uploadIdx = commands.findIndex((c) =>
      c.includes('wrangler versions upload'),
    );

    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(uploadIdx).toBeGreaterThan(buildIdx);
  });

  it('enables the dev phase override flag for the preview build (requirement 7-5)', () => {
    const workflow = loadWorkflow();
    const job = workflow.jobs['deploy-preview'];
    const commands = runCommands(job);

    expect(
      commands.some((c) =>
        c.includes('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE=true'),
      ),
    ).toBe(true);
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
        'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=prod -- pnpm exec tsx scripts/deploy-with-cpu-limit-fallback.ts pnpm exec opennextjs-cloudflare deploy',
      ),
    );

    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(deployIdx).toBeGreaterThan(buildIdx);
  });
});

describe('.github/workflows/frontend-ci.yml — signage hub deploy', () => {
  const HUB_DEPLOY =
    'infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=prod -- pnpm exec wrangler deploy -c workers/signage-hub/wrangler.toml';

  it('deploy-prod deploys the hub with the Infisical prod env before the site', () => {
    const commands = runCommands(loadWorkflow().jobs['deploy-prod']);
    const hubIdx = commands.findIndex((c) => c.includes(HUB_DEPLOY));
    const siteIdx = commands.findIndex((c) =>
      c.includes('pnpm exec opennextjs-cloudflare deploy'),
    );

    expect(hubIdx).toBeGreaterThanOrEqual(0);
    expect(siteIdx).toBeGreaterThan(hubIdx);
  });

  it('deploy-dev and deploy-preview never deploy the hub', () => {
    const workflow = loadWorkflow();
    for (const name of ['deploy-dev', 'deploy-preview']) {
      const commands = runCommands(workflow.jobs[name]).join('\n');
      expect(commands).not.toMatch(/signage-hub/);
    }
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

describe('.github/workflows/frontend-ci.yml — CPU limit fallback', () => {
  const WRAPPER = 'pnpm exec tsx scripts/deploy-with-cpu-limit-fallback.ts ';

  it.each([
    ['deploy-preview', 'pnpm exec wrangler versions upload'],
    ['deploy-dev', 'pnpm exec wrangler deploy --env=dev'],
    ['deploy-prod', 'pnpm exec opennextjs-cloudflare deploy'],
  ])('%s runs the site deploy through the fallback wrapper', (job, deploy) => {
    const commands = runCommands(loadWorkflow().jobs[job]);
    expect(commands.some((c) => c.includes(WRAPPER + deploy))).toBe(true);
  });

  it('never runs the site deploy commands without the wrapper', () => {
    const workflow = loadWorkflow();
    for (const name of ['deploy-preview', 'deploy-dev', 'deploy-prod']) {
      for (const c of runCommands(workflow.jobs[name])) {
        expect(c).not.toMatch(
          /(?<!deploy-with-cpu-limit-fallback\.ts )pnpm exec (wrangler versions upload|wrangler deploy --env|opennextjs-cloudflare deploy)/,
        );
      }
    }
  });
});

describe('.github/workflows/frontend-ci.yml — D1 migrations and stamp secrets', () => {
  const MIGRATE = 'wrangler d1 migrations apply STAMP_DB --remote';
  const DEPLOYS: Record<string, string> = {
    'deploy-preview': 'wrangler versions upload',
    'deploy-dev': 'wrangler deploy --env=dev',
    'deploy-prod': 'opennextjs-cloudflare deploy',
  };

  it.each([
    ['deploy-preview', `${MIGRATE} --env=dev`, 'staging'],
    ['deploy-dev', `${MIGRATE} --env=dev`, 'staging'],
    ['deploy-prod', MIGRATE, 'prod'],
  ])(
    '%s applies migrations to the right DB before deploying',
    (job, cmd, env) => {
      const commands = runCommands(loadWorkflow().jobs[job]);
      const migrateIdx = commands.findIndex(
        (c) =>
          c.includes(cmd + '\n') || c.endsWith(cmd) || c.includes(cmd + ' '),
      );
      const deployIdx = commands.findIndex((c) => c.includes(DEPLOYS[job]));
      expect(migrateIdx).toBeGreaterThanOrEqual(0);
      expect(commands[migrateIdx]).toContain(`--env=${env} --`);
      if (job === 'deploy-prod')
        expect(commands[migrateIdx]).not.toContain('--env=dev');
      expect(deployIdx).toBeGreaterThan(migrateIdx);
    },
  );

  it('preview uploads with a temporary config that points STAMP_DB at the dev DB', () => {
    const commands = runCommands(loadWorkflow().jobs['deploy-preview']);
    const writeIdx = commands.findIndex((c) =>
      c.includes('write-preview-wrangler-config.ts .wrangler.preview.toml'),
    );
    const uploadIdx = commands.findIndex((c) =>
      c.includes('wrangler versions upload --config .wrangler.preview.toml'),
    );
    expect(writeIdx).toBeGreaterThanOrEqual(0);
    expect(uploadIdx).toBeGreaterThan(writeIdx);
  });

  it.each([
    ['deploy-preview', 'preview'],
    ['deploy-dev', 'dev'],
    ['deploy-prod', 'prod'],
  ])('%s writes STAMP_ENV=%s into the secrets file', (job, value) => {
    const joined = runCommands(loadWorkflow().jobs[job]).join('\n');
    expect(joined).toContain(`"STAMP_ENV": "${value}"`);
    for (const other of ['preview', 'dev', 'prod'].filter((v) => v !== value)) {
      expect(joined).not.toContain(`"STAMP_ENV": "${other}"`);
    }
  });

  it('adds STAFF_OIDC_CLIENT_SECRET from Infisical prod for prod and dev only', () => {
    const workflow = loadWorkflow();
    for (const job of ['deploy-dev', 'deploy-prod']) {
      const step = runCommands(workflow.jobs[job]).find((c) =>
        c.includes('STAFF_OIDC_CLIENT_SECRET'),
      );
      expect(step).toContain('--env=prod --');
    }
    expect(
      runCommands(workflow.jobs['deploy-preview']).join('\n'),
    ).not.toContain('STAFF_OIDC_CLIENT_SECRET');
  });
});
