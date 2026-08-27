import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptimizer, buildTransformationParams, isSupportedType } from './image-optimize/index.js';

test('isSupportedType', () => {
  assert.equal(isSupportedType('image/jpeg'), true);
  assert.equal(isSupportedType('image/png'), true);
  assert.equal(isSupportedType('image/webp'), true);
  assert.equal(isSupportedType('image/gif'), false);
  assert.equal(isSupportedType('application/pdf'), false);
  assert.equal(isSupportedType(null), false);
  assert.equal(isSupportedType(undefined), false);
});

test('buildTransformationParams', () => {
  const params = buildTransformationParams();
  assert.deepEqual(params, {
    format: 'webp',
    quality: 82,
    width: 2000,
    height: 2000,
    fit: 'inside',
    withoutEnlargement: true
  });
});

test('createOptimizer', async (t) => {
  // 1. MIME判定
  await t.test('Skips unsupported MIME types', async () => {
    const optimizer = createOptimizer({
      services: { AssetsService: class {}, FilesService: class {} },
      getSchema: async () => ({}),
      database: {},
      logger: { warn: () => {}, info: () => {} }
    });

    const resultPdf = await optimizer.optimize({
      key: 'test-1',
      payload: { type: 'application/pdf', filename_download: 'doc.pdf' }
    });
    assert.deepEqual(resultPdf, { status: 'skipped', key: 'test-1', reason: 'unsupported-type' });

    const resultGif = await optimizer.optimize({
      key: 'test-2',
      payload: { type: 'image/gif', filename_download: 'anim.gif' }
    });
    assert.deepEqual(resultGif, { status: 'skipped', key: 'test-2', reason: 'unsupported-type' });
  });

  // 2. 変換パラメータ生成と 4. 再帰防止 (emitEvents: false)
  await t.test('Optimizes supported images with correct params and emitEvents: false', async () => {
    let getAssetCalledWith = null;
    let uploadOneCalledWith = null;

    class FakeAssetsService {
      constructor({ accountability, schema }) {}
      async getAsset(key, options) {
        getAssetCalledWith = { key, options };
        // 実サービスは { stream, file, stat } を返す
        return { stream: 'fake-stream', file: { id: key }, stat: { size: 1 } };
      }
    }

    class FakeFilesService {
      constructor({ accountability, schema, knex }) {}
      async uploadOne(stream, payload, key, options) {
        uploadOneCalledWith = { stream, payload, key, options };
      }
    }

    let infoLogs = [];
    const optimizer = createOptimizer({
      services: { AssetsService: FakeAssetsService, FilesService: FakeFilesService },
      getSchema: async () => ({ isFakeSchema: true }),
      database: { isFakeDb: true },
      logger: {
        info: (msg) => infoLogs.push(msg),
        warn: () => {}
      }
    });

    const result = await optimizer.optimize({
      key: 'test-3',
      payload: { type: 'image/jpeg', filename_download: 'photo.jpeg' }
    });

    assert.deepEqual(result, { status: 'optimized', key: 'test-3' });

    assert.deepEqual(getAssetCalledWith.options.transformationParams, {
      format: 'webp',
      quality: 82,
      width: 2000,
      height: 2000,
      fit: 'inside',
      withoutEnlargement: true
    });

    assert.equal(uploadOneCalledWith.options.emitEvents, false);

    assert.equal(uploadOneCalledWith.payload.type, 'image/webp');
    assert.equal(uploadOneCalledWith.payload.filename_download, 'photo.webp');
    assert.equal(uploadOneCalledWith.key, 'test-3');
    assert.equal(uploadOneCalledWith.stream, 'fake-stream');

    assert.ok(infoLogs.some(log => log.includes('test-3')));
  });

  // 3. 失敗時の分岐
  await t.test('Returns failed and does not call uploadOne on getAsset exception', async () => {
    let uploadOneCalled = false;

    class FakeAssetsService {
      constructor() {}
      async getAsset() {
        throw new Error('Fake asset error');
      }
    }

    class FakeFilesService {
      constructor() {}
      async uploadOne() {
        uploadOneCalled = true;
      }
    }

    let warnLogs = [];
    const optimizer = createOptimizer({
      services: { AssetsService: FakeAssetsService, FilesService: FakeFilesService },
      getSchema: async () => ({}),
      database: {},
      logger: {
        info: () => {},
        warn: (msg) => warnLogs.push(msg)
      }
    });

    const result = await optimizer.optimize({
      key: 'test-4',
      payload: { type: 'image/png', filename_download: 'fail.png' }
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.key, 'test-4');
    assert.equal(result.error.message, 'Fake asset error');
    assert.equal(uploadOneCalled, false);

    assert.ok(warnLogs.some(log => log.includes('test-4')));
  });
});
