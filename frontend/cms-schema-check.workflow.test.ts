import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/cms-schema-check.yml',
);

type Step = { name?: string; run?: string; uses?: string; if?: string };
type Workflow = {
  on: Record<string, { paths?: string[] } | null>;
  jobs: Record<string, { steps: Step[] }>;
};

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow;

describe('cms-schema-check workflow', () => {
  it('コレクション定義とグローバル定義の変更で発火する', () => {
    expect(workflow.on.pull_request?.paths).toEqual([
      'cms/src/collections/**',
      'cms/src/globals/**',
    ]);
  });

  it('base ref と比較する検出コマンドを実行する', () => {
    const step = workflow.jobs.check.steps.find((s) =>
      (s.run ?? '').includes('pnpm check:schema'),
    );
    expect(step?.run).toContain('origin/${{ github.base_ref }}');
  });

  it('確認済みラベルが付いている場合のみ検出をスキップする', () => {
    const detect = workflow.jobs.check.steps.find((s) =>
      (s.run ?? '').includes('pnpm check:schema'),
    );
    const ack = workflow.jobs.check.steps.find((s) =>
      (s.run ?? '').includes('breaking-change-acknowledged ラベル'),
    );
    expect(detect?.if).toContain('!contains');
    expect(detect?.if).toContain('breaking-change-acknowledged');
    expect(ack?.if).toContain('breaking-change-acknowledged');
  });

  it('検出時にフロントエンド側のデプロイ済み確認を要求する', () => {
    const ack = workflow.jobs.check.steps.find((s) =>
      (s.run ?? '').includes('breaking-change-acknowledged ラベル'),
    );
    expect(ack?.run).toContain('デプロイ・安定稼働済み');
  });
});
