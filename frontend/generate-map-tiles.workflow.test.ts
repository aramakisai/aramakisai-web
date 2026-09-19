import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/generate-map-tiles.yml',
);

type Step = { name?: string; run?: string; uses?: string };
type Workflow = {
  on: Record<string, unknown>;
  jobs: Record<string, { steps: Step[] }>;
};

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow;
const steps = workflow.jobs.generate.steps;

describe('generate-map-tiles workflow', () => {
  it('workflow_dispatch のみで発火し、push/pull_request のトリガーを持たない', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
  });

  it('レンダリング前に範囲算出スクリプトを実行し、閾値超過時に停止できる', () => {
    const boundsStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/map-tile-bounds.ts'),
    );
    const importStepIndex = steps.findIndex((s) =>
      s.run?.includes('openstreetmap-tile-server'),
    );
    expect(boundsStepIndex).toBeGreaterThanOrEqual(0);
    expect(importStepIndex).toBeGreaterThan(boundsStepIndex);
  });

  it('OpenStreetMap のデータ (Geofabrik) から取得し、他者が運用するタイル配信サービスを参照しない', () => {
    const allRun = steps.map((s) => s.run ?? '').join('\n');
    expect(allRun).toContain('download.geofabrik.de');
    expect(allRun).not.toMatch(
      /tile\.openstreetmap\.org|mapbox|maptiler|stadiamaps|thunderforest/i,
    );
  });

  it('生成後に検証スクリプトを実行してから artifact をアップロードする', () => {
    const verifyStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/verify-map-tiles.ts'),
    );
    const uploadStepIndex = steps.findIndex((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    );
    expect(verifyStepIndex).toBeGreaterThanOrEqual(0);
    expect(uploadStepIndex).toBeGreaterThan(verifyStepIndex);
  });
});
