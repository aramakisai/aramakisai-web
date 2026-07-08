import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/directus-schema-sync.yml',
);
const CLAUDE_MD_PATH = path.resolve(__dirname, '../CLAUDE.md');

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
    push?: { branches?: string[]; paths?: string[] };
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

describe('.github/workflows/directus-schema-sync.yml — 4.1 snapshot diff detection', () => {
  it('triggers only on push to main for schema/migration paths', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.push?.branches).toEqual(['main']);
    expect(workflow.on.push?.paths).toEqual(
      expect.arrayContaining([
        'directus/schema/snapshot.yaml',
        'directus/migrations/**',
      ]),
    );
  });

  it('checks out with enough history to diff against the previous commit', () => {
    const workflow = loadWorkflow();
    const checkout = findStep(
      workflow,
      (s) =>
        s.uses?.startsWith('actions/checkout') === true && !s.with?.repository,
    );
    expect(checkout.with?.['fetch-depth']).toBeGreaterThanOrEqual(2);
  });

  it('detects whether snapshot.yaml changed against the previous commit', () => {
    const workflow = loadWorkflow();
    const diffStep = findStep(workflow, (s) => s.id === 'diff');
    expect(diffStep.run).toMatch(/git diff --name-only HEAD\^ HEAD/);
    expect(diffStep.run).toMatch(/directus\/schema\/snapshot\.yaml/);
    expect(diffStep.run).toMatch(/changed=true/);
    expect(diffStep.run).toMatch(/changed=false/);
  });

  it('gates every downstream step on the diff result so an unchanged push does nothing', () => {
    const workflow = loadWorkflow();
    const steps = allSteps(workflow);
    const diffIndex = steps.findIndex((s) => s.id === 'diff');
    const downstream = steps.slice(diffIndex + 1);
    expect(downstream.length).toBeGreaterThan(0);
    for (const step of downstream) {
      expect(step.if).toMatch(/steps\.diff\.outputs\.changed == 'true'/);
    }
  });
});

describe('.github/workflows/directus-schema-sync.yml — 4.2 GitHub App auth', () => {
  it('never references a PAT-style secret, only the Infisical machine identity', () => {
    const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
    const referenced = [...raw.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const allowed = new Set(['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET']);
    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(allowed.has(name)).toBe(true);
    }
  });

  it('generates a short-lived installation token scoped to aramakisai-infra only', () => {
    const workflow = loadWorkflow();
    const tokenStep = findStep(
      workflow,
      (s) => s.uses?.startsWith('actions/create-github-app-token') === true,
    );
    expect(tokenStep.with?.owner).toBe('aramakisai');
    expect(String(tokenStep.with?.repositories)).toContain('aramakisai-infra');
    expect(tokenStep.with?.['permission-contents']).toBe('write');
    expect(tokenStep.with?.['permission-pull-requests']).toBe('write');
  });

  it('sources the App id/private key from Infisical rather than hardcoding them', () => {
    const workflow = loadWorkflow();
    const credsStep = findStep(workflow, (s) => s.id === 'app_creds');
    expect(credsStep.run).toMatch(/infisical run/);
    expect(credsStep.run).toMatch(/add-mask/);

    const tokenStep = findStep(
      workflow,
      (s) => s.uses?.startsWith('actions/create-github-app-token') === true,
    );
    expect(String(tokenStep.with?.['app-id'])).toMatch(
      /steps\.app_creds\.outputs\.app_id/,
    );
    expect(String(tokenStep.with?.['private-key'])).toMatch(
      /steps\.app_creds\.outputs\.private_key/,
    );
  });

  it('checks out the infra repo using the generated App token, not the default GITHUB_TOKEN', () => {
    const workflow = loadWorkflow();
    const infraCheckout = findStep(
      workflow,
      (s) => s.with?.repository === 'aramakisai/aramakisai-infra',
    );
    expect(String(infraCheckout.with?.token)).toMatch(
      /steps\.app_token\.outputs\.token/,
    );
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
});

describe('.github/workflows/directus-schema-sync.yml — 4.3 ConfigMap generation and branch push', () => {
  it('generates the schema ConfigMap for both prod and staging', () => {
    const workflow = loadWorkflow();
    const genStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('kubectl create configmap directus-schema')),
    );
    expect(genStep.run).toMatch(/for ENV in prod staging/);
    expect(genStep.run).toMatch(
      /infra\/gitops\/manifests\/\$ENV\/directus\/schema-configmap\.yaml/,
    );
  });

  it('optionally generates a migrations ConfigMap when migration files exist', () => {
    const workflow = loadWorkflow();
    const genStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('kubectl create configmap directus-schema')),
    );
    expect(genStep.run).toMatch(/directus-migrations/);
    expect(genStep.run).toMatch(/compgen -G/);
  });

  it('creates a branch named after the 8-char commit SHA and skips push if it already exists', () => {
    const workflow = loadWorkflow();
    const branchStep = findStep(workflow, (s) => s.id === 'push_branch');
    expect(branchStep.run).toMatch(/directus-schema-\$\{SHA8\}/);
    expect(branchStep.run).toMatch(/GITHUB_SHA::8/);
    expect(branchStep.run).toMatch(/git ls-remote --exit-code --heads origin/);
  });

  it('skips commit/push when the generated manifests produce no diff', () => {
    const workflow = loadWorkflow();
    const branchStep = findStep(workflow, (s) => s.id === 'push_branch');
    expect(branchStep.run).toMatch(/git diff --cached --quiet/);
  });
});

describe('.github/workflows/directus-schema-sync.yml — 4.4 infra PR + staging gate + additive-only', () => {
  it('skips PR creation when a PR for the same branch/SHA already exists', () => {
    const workflow = loadWorkflow();
    const prStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('gh pr create')),
    );
    expect(prStep.run).toMatch(/gh pr list/);
    expect(prStep.run).toMatch(/already exists/);
    expect(prStep.run).toMatch(/exit 0/);
  });

  it('includes the triggering commit SHA in the PR title/body with a link back to the source commit', () => {
    const workflow = loadWorkflow();
    const prStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('gh pr create')),
    );
    expect(prStep.run).toMatch(/\$\{SHA8\}/);
    expect(prStep.run).toMatch(
      /github\.com\/aramakisai\/aramakisai-web\/commit/,
    );
  });

  it('embeds a staging schema-apply confirmation checklist item and stg-api reference', () => {
    const workflow = loadWorkflow();
    const prStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('gh pr create')),
    );
    expect(prStep.run).toMatch(/- \[ \].*schema-apply/);
    expect(prStep.run).toMatch(/staging/);
    expect(prStep.run).toMatch(/stg-api\.aramakisai\.com/);
  });

  it('embeds an additive-only checklist item referencing CLAUDE.md', () => {
    const workflow = loadWorkflow();
    const prStep = findStep(workflow, (s) =>
      Boolean(s.run?.includes('gh pr create')),
    );
    expect(prStep.run).toMatch(/- \[ \].*破壊的変更/);
    expect(prStep.run).toMatch(/CLAUDE\.md/);
  });

  it('documents the additive-only rule in CLAUDE.md', () => {
    const claudeMd = readFileSync(CLAUDE_MD_PATH, 'utf-8');
    expect(claudeMd).toMatch(/additive.only|追加のみ/i);
    expect(claudeMd).toMatch(/カラム削除|型変更/);
  });
});
