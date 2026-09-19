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

  it('OSM extract のダウンロード後、osmium で使う前にサイズと PBF ヘッダーを検証する', () => {
    const downloadStepIndex = steps.findIndex((s) =>
      s.run?.includes('download.geofabrik.de'),
    );
    const verifyDownloadStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/verify-osm-download.ts'),
    );
    const extractStepIndex = steps.findIndex((s) =>
      s.run?.includes('osmium extract'),
    );
    expect(downloadStepIndex).toBeGreaterThanOrEqual(0);
    expect(verifyDownloadStepIndex).toBeGreaterThan(downloadStepIndex);
    expect(extractStepIndex).toBeGreaterThan(verifyDownloadStepIndex);
  });

  it('ダウンロードは一時的なネットワーク障害に備えてリトライする', () => {
    const downloadStep = steps.find((s) =>
      s.run?.includes('download.geofabrik.de'),
    );
    expect(downloadStep?.run).toMatch(/curl [\s\S]*--retry/);
  });

  it('都道府県単位ではなく実在する地域 extract (kanto) を取得する', () => {
    const downloadStep = steps.find((s) =>
      s.run?.includes('download.geofabrik.de'),
    );
    expect(downloadStep?.run).toContain(
      'https://download.geofabrik.de/asia/japan/kanto-latest.osm.pbf',
    );
  });

  it('renderd の実際のタイル出力先 (/var/cache/renderd/tiles) をホストへバインドする', () => {
    const renderStep = steps.find((s) => s.run?.includes('render_list'));
    const commandLines = (renderStep?.run ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(commandLines).toContain(
      '-v "$PWD/metatiles:/var/cache/renderd/tiles"',
    );
    expect(commandLines).not.toContain('/data/tiles');
    expect(commandLines).not.toContain('docker cp');
  });

  it('renderd の起動 (ソケット生成) を待ってから render_list を実行する', () => {
    const renderStep = steps.find((s) => s.run?.includes('render_list'));
    const commandLines = (renderStep?.run ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    const socketWaitIndex = commandLines.indexOf('/run/renderd/renderd.sock');
    const renderListIndex = commandLines.indexOf('render_list');
    expect(socketWaitIndex).toBeGreaterThanOrEqual(0);
    expect(renderListIndex).toBeGreaterThan(socketWaitIndex);
  });

  it('render_list の完了後、HTTP 取得の前に Apache の起動を待つ', () => {
    const renderStepIndex = steps.findIndex((s) =>
      s.run?.includes('render_list'),
    );
    const apacheWaitStepIndex = steps.findIndex((s) =>
      s.name?.includes('Wait for tile server HTTP endpoint'),
    );
    const fetchStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/fetch-map-tiles.ts'),
    );
    expect(renderStepIndex).toBeGreaterThanOrEqual(0);
    expect(apacheWaitStepIndex).toBeGreaterThan(renderStepIndex);
    expect(fetchStepIndex).toBeGreaterThan(apacheWaitStepIndex);
  });

  it('mod_tile の HTTP エンドポイントから個別タイルを取得してから検証する', () => {
    const fetchStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/fetch-map-tiles.ts'),
    );
    const verifyStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/verify-map-tiles.ts'),
    );
    expect(fetchStepIndex).toBeGreaterThanOrEqual(0);
    expect(verifyStepIndex).toBeGreaterThan(fetchStepIndex);
  });

  it('取得後・検証前に PNG を webp へ変換する', () => {
    const fetchStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/fetch-map-tiles.ts'),
    );
    const convertStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/convert-map-tiles-to-webp.ts'),
    );
    const verifyStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/verify-map-tiles.ts'),
    );
    expect(convertStepIndex).toBeGreaterThan(fetchStepIndex);
    expect(verifyStepIndex).toBeGreaterThan(convertStepIndex);
  });

  it('メタタイルの置き場と PNG の置き場を分け、artifact と検証は PNG 側を指す', () => {
    const renderStep = steps.find((s) => s.run?.includes('render_list'));
    expect(renderStep?.run).toContain('metatiles');
    expect(renderStep?.run).not.toMatch(/rendered-tiles/);

    const verifyStep = steps.find((s) =>
      s.run?.includes('scripts/verify-map-tiles.ts'),
    );
    expect(verifyStep?.run).toContain('MAP_TILES_DIR="$PWD/rendered-tiles"');

    const uploadStep = steps.find((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    );
    expect(
      (uploadStep as unknown as { with?: { path?: string } })?.with?.path,
    ).toBe('frontend/rendered-tiles');
  });
});
