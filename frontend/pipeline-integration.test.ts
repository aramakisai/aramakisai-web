import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

const FRONTEND_CI_PATH = path.resolve(
  __dirname,
  '../.github/workflows/frontend-ci.yml',
);
const SCHEMA_SYNC_PATH = path.resolve(
  __dirname,
  '../.github/workflows/directus-schema-sync.yml',
);

type Step = {
  id?: string;
  run?: string;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
};
type Job = { if?: string; needs?: string | string[]; steps: Step[] };
type Workflow = { jobs: Record<string, Job> };

function loadWorkflow(p: string): Workflow {
  return parse(readFileSync(p, 'utf-8'));
}

function findStep(workflow: Workflow, predicate: (s: Step) => boolean): Step {
  const step = Object.values(workflow.jobs)
    .flatMap((j) => j.steps)
    .find(predicate);
  expect(step).toBeDefined();
  return step as Step;
}

function needsArray(job: Job): string[] {
  if (!job.needs) return [];
  return Array.isArray(job.needs) ? job.needs : [job.needs];
}

function run(script: string, opts: { cwd: string; env: NodeJS.ProcessEnv }) {
  return execFileSync('bash', ['-c', script], {
    cwd: opts.cwd,
    env: opts.env,
    encoding: 'utf-8',
  });
}

function makeTempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

// Requirement 1.3 / 6.1: every deploy-* job in frontend-ci must be gated on `validate`,
// so a failing type-check/build never reaches a Workers deploy.
describe('pipeline integration — validation gate (1.3, 6.1)', () => {
  it('every deploy job depends on validate', () => {
    const workflow = loadWorkflow(FRONTEND_CI_PATH);
    const deployJobs = Object.entries(workflow.jobs).filter(([name]) =>
      name.startsWith('deploy'),
    );
    expect(deployJobs.length).toBeGreaterThan(0);
    for (const [, job] of deployJobs) {
      expect(needsArray(job)).toContain('validate');
    }
  });
});

// Requirement 7.6: no job that touches Infisical secrets may run unguarded on a fork PR.
describe('pipeline integration — secret exposure gate (7.6)', () => {
  it('any job referencing INFISICAL secrets on pull_request is gated on non-fork', () => {
    for (const wfPath of [FRONTEND_CI_PATH, SCHEMA_SYNC_PATH]) {
      const workflow = loadWorkflow(wfPath);
      for (const job of Object.values(workflow.jobs)) {
        const usesSecrets = JSON.stringify(job).includes('secrets.INFISICAL_');
        const isPrTriggered = job.if?.includes('pull_request') ?? false;
        if (usesSecrets && isPrTriggered) {
          expect(job.if).toMatch(/head\.repo\.fork == false/);
        }
      }
    }
  });
});

// Requirement 2.2: unchanged snapshot.yaml must not trigger any infra PR / manifest work.
// Executed against the real bash from the workflow (not a regex proxy) in a throwaway git repo.
describe('pipeline integration — snapshot diff detection (2.2)', () => {
  function extractDiffScript(): string {
    const workflow = loadWorkflow(SCHEMA_SYNC_PATH);
    const step = findStep(workflow, (s) => s.id === 'diff');
    return step.run as string;
  }

  function initRepo(): string {
    const dir = makeTempDir('schema-diff-');
    run(
      'git init -q && git config user.email t@t.com && git config user.name t',
      {
        cwd: dir,
        env: process.env,
      },
    );
    mkdirSync(path.join(dir, 'directus/schema'), { recursive: true });
    return dir;
  }

  function commitAll(dir: string, message: string) {
    run(`git add -A && git commit -q -m "${message}"`, {
      cwd: dir,
      env: process.env,
    });
  }

  it('reports changed=false when snapshot.yaml is untouched between commits', () => {
    const dir = initRepo();
    writeFileSync(path.join(dir, 'directus/schema/snapshot.yaml'), 'v1\n');
    writeFileSync(path.join(dir, 'unrelated.txt'), 'a\n');
    commitAll(dir, 'initial');
    writeFileSync(path.join(dir, 'unrelated.txt'), 'b\n');
    commitAll(dir, 'unrelated change');

    const outputFile = path.join(dir, 'gh_output');
    writeFileSync(outputFile, '');
    run(extractDiffScript(), {
      cwd: dir,
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });

    expect(readFileSync(outputFile, 'utf-8')).toContain('changed=false');
  });

  it('reports changed=true when snapshot.yaml is modified in the triggering commit', () => {
    const dir = initRepo();
    writeFileSync(path.join(dir, 'directus/schema/snapshot.yaml'), 'v1\n');
    writeFileSync(path.join(dir, 'unrelated.txt'), 'a\n');
    commitAll(dir, 'initial');
    writeFileSync(path.join(dir, 'directus/schema/snapshot.yaml'), 'v2\n');
    commitAll(dir, 'schema change');

    const outputFile = path.join(dir, 'gh_output');
    writeFileSync(outputFile, '');
    run(extractDiffScript(), {
      cwd: dir,
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });

    expect(readFileSync(outputFile, 'utf-8')).toContain('changed=true');
  });
});

// Requirement 3.5: re-running for the same commit SHA must never create a duplicate infra PR.
// Executed against the real bash, with `gh` stubbed to simulate an already-open PR.
describe('pipeline integration — idempotent infra PR (3.5)', () => {
  function extractPrScript(): string {
    const workflow = loadWorkflow(SCHEMA_SYNC_PATH);
    const step = findStep(workflow, (s) =>
      Boolean(s.run?.includes('gh pr create')),
    );
    return (step.run as string)
      .replace('${{ steps.push_branch.outputs.sha8 }}', 'abcd1234')
      .replace(
        '${{ steps.push_branch.outputs.branch }}',
        'directus-schema-abcd1234',
      );
  }

  function stubGh(dir: string, listOutput: string): string {
    const binDir = path.join(dir, 'bin');
    mkdirSync(binDir, { recursive: true });
    const logFile = path.join(dir, 'gh_calls.log');
    writeFileSync(logFile, '');
    writeFileSync(
      path.join(binDir, 'gh'),
      `#!/usr/bin/env bash\necho "$*" >> "${logFile}"\nif [ "$1" = "pr" ] && [ "$2" = "list" ]; then\n  echo "${listOutput}"\nfi\nexit 0\n`,
      { mode: 0o755 },
    );
    return logFile;
  }

  it('skips gh pr create when a PR for the same SHA already exists', () => {
    const dir = makeTempDir('pr-idempotent-');
    const logFile = stubGh(dir, '42');

    run(extractPrScript(), {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
        GH_TOKEN: 'dummy',
        GITHUB_SHA: 'abcd1234abcd1234abcd1234abcd1234abcd1234',
      },
    });

    const calls = readFileSync(logFile, 'utf-8');
    expect(calls).toMatch(/pr list/);
    expect(calls).not.toMatch(/pr create/);
  });

  it('creates the PR when none exists yet for the SHA', () => {
    const dir = makeTempDir('pr-idempotent-');
    const logFile = stubGh(dir, '');

    run(extractPrScript(), {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
        GH_TOKEN: 'dummy',
        GITHUB_SHA: 'abcd1234abcd1234abcd1234abcd1234abcd1234',
      },
    });

    const calls = readFileSync(logFile, 'utf-8');
    expect(calls).toMatch(/pr list/);
    expect(calls).toMatch(/pr create/);
  });
});
