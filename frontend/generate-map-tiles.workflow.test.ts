import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const WORKFLOW_PATH = path.resolve(
  __dirname,
  '../.github/workflows/generate-map-tiles.yml',
);

type Step = {
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
};
type Workflow = {
  on: {
    workflow_dispatch: {
      inputs?: Record<string, Record<string, unknown>>;
    };
  };
  env?: Record<string, string>;
  jobs: Record<string, { steps: Step[] }>;
};

const workflow = parse(readFileSync(WORKFLOW_PATH, 'utf8')) as Workflow;
const steps = workflow.jobs.generate.steps;

describe('generate-map-tiles workflow', () => {
  it('workflow_dispatch のみで発火し、push/pull_request のトリガーを持たない', () => {
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
  });

  it('campus・regionalだけを必須のchoiceとして受け取る', () => {
    const profileInput = workflow.on.workflow_dispatch.inputs?.profile;
    expect(profileInput).toMatchObject({
      required: true,
      type: 'choice',
      options: ['campus', 'regional'],
    });
    expect(workflow.env?.MAP_TILE_PROFILE).toBe('${{ inputs.profile }}');
  });

  it('profileを検証して出力先を解決してから範囲を算出する', () => {
    const profileStepIndex = steps.findIndex((s) => s.id === 'profile');
    const boundsStepIndex = steps.findIndex((s) =>
      s.run?.includes('scripts/map-tile-bounds.ts'),
    );
    expect(profileStepIndex).toBeGreaterThanOrEqual(0);
    expect(steps[profileStepIndex]?.run).toContain(
      'case "$MAP_TILE_PROFILE" in',
    );
    expect(steps[profileStepIndex]?.run).toMatch(
      /\*\)[\s\S]*::error::[\s\S]*exit 1/,
    );
    expect(boundsStepIndex).toBeGreaterThan(profileStepIndex);
  });

  it('campusの既存成果物を維持し、regionalを別directory・artifactへ隔離する', () => {
    const profileStep = steps.find((s) => s.id === 'profile');
    const campusBranch = profileStep?.run?.match(
      /campus\)([\s\S]*?)\s*;;/,
    )?.[1];
    const regionalBranch = profileStep?.run?.match(
      /regional\)([\s\S]*?)\s*;;/,
    )?.[1];

    expect(campusBranch).toContain('output-directory=rendered-tiles');
    expect(campusBranch).toContain('artifact-name=map-tiles');
    expect(regionalBranch).toContain('output-directory=regional-map-tiles');
    expect(regionalBranch).toContain('artifact-name=regional-map-tiles');
    expect(profileStep?.run).not.toContain('scripts/');
  });

  it('全タイルscriptへ同じprofile引数を明示的に渡す', () => {
    const scriptNames = [
      'map-tile-bounds.ts',
      'fetch-map-tiles.ts',
      'convert-map-tiles-to-webp.ts',
      'verify-map-tiles.ts',
    ];
    for (const scriptName of scriptNames) {
      const step = steps.find((candidate) =>
        candidate.run?.includes(`scripts/${scriptName}`),
      );
      expect(step?.run, scriptName).toContain('--profile "$MAP_TILE_PROFILE"');
    }
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

  it('選択profileの抽出PBFをcampus固有名にせず、そのままimportへ渡す', () => {
    const extractStep = steps.find((s) => s.run?.includes('osmium extract'));
    const importStep = steps.find((s) =>
      s.run?.includes('openstreetmap-tile-server'),
    );
    expect(extractStep?.run).toContain('-o selected-profile.osm.pbf');
    expect(importStep?.run).toContain(
      '$PWD/selected-profile.osm.pbf:/data/region.osm.pbf',
    );
    expect(extractStep?.run).not.toContain('campus.osm.pbf');
    expect(importStep?.run).not.toContain('campus.osm.pbf');
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

  it('メタタイルとprofile別タイルを分け、検証とartifactは選択profileだけを指す', () => {
    const renderStep = steps.find((s) => s.run?.includes('render_list'));
    expect(renderStep?.run).toContain('metatiles');
    expect(renderStep?.run).not.toMatch(/rendered-tiles/);

    const verifyStep = steps.find((s) =>
      s.run?.includes('scripts/verify-map-tiles.ts'),
    );
    expect(verifyStep?.run).toContain(
      'MAP_TILES_DIR="$PWD/${{ steps.profile.outputs.output-directory }}"',
    );

    const uploadStep = steps.find((s) =>
      s.uses?.startsWith('actions/upload-artifact'),
    );
    expect(uploadStep?.with?.name).toBe(
      '${{ steps.profile.outputs.artifact-name }}',
    );
    expect(uploadStep?.with?.path).toBe(
      'frontend/${{ steps.profile.outputs.output-directory }}',
    );
  });
});
