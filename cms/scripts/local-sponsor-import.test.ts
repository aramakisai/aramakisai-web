import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { s3Storage } from '@payloadcms/storage-s3'
import { en } from '@payloadcms/translations/languages/en'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

import { Media } from '../src/collections/media'

import {
  applyLocalSponsorImportPlan,
  createLocalSponsorImportPlan,
  type LocalSponsorMediaCleanupToken,
  type LocalSponsorImportStore,
  validateLocalSponsorImportBundle,
  type ValidatedLocalSponsorImportRow,
} from './local-sponsor-import'
import {
  createBundleManifest,
  deletePayloadStorageBlobs,
  ensureRemoteStorageForApply,
  main as runLocalSponsorImportMain,
  parseLocalSponsorImportArgs,
  PayloadLocalSponsorImportStore,
  runLocalSponsorImport,
  uploadPayloadStorageBlobs,
} from './import-local-sponsors'

const PNG = await sharp({
  create: { width: 2000, height: 1000, channels: 3, background: '#fff' },
})
  .png()
  .toBuffer()

let fixtureRoot: string

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(tmpdir(), 'local-sponsor-import-'))
  writeFileSync(path.join(fixtureRoot, 'sample.png'), PNG)
  writeFileSync(path.join(fixtureRoot, 'not-image.txt'), 'fixture')
})

afterEach(() => rmSync(fixtureRoot, { recursive: true, force: true }))

const validRow = (overrides: Record<string, unknown> = {}) => ({
  importId: 'fixture-001',
  name: 'テスト専用地域協賛',
  category: 'hospital',
  latitude: 36.4,
  longitude: 139.1,
  address: null,
  imageFile: 'sample.png',
  imageAlt: 'テスト専用画像',
  imageDecorative: false,
  message: null,
  businessHours: null,
  closedDays: null,
  phone: '027-000-0000',
  websiteUrl: 'https://example.invalid/shop',
  order: null,
  ...overrides,
})

describe('validateLocalSponsorImportBundle', () => {
  it('canonicalカテゴリの正常なJSONと画像を全件検証する', async () => {
    const result = await validateLocalSponsorImportBundle(
      JSON.stringify([
        validRow({ category: 'life' }),
        validRow({
          importId: 'fixture-002',
          category: 'car',
          imageFile: null,
          imageAlt: null,
          phone: null,
          order: 2,
        }),
      ]),
      { imageRoot: fixtureRoot, existingImportIds: [] },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.rows.map(({ importId, category }) => [importId, category])).toEqual([
      ['fixture-001', 'life'],
      ['fixture-002', 'car'],
    ])
    expect(result.rows[0].image).toMatchObject({
      relativePath: 'sample.png',
      mimeType: 'image/png',
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(result.rows[1]).toMatchObject({ image: null, phone: null, order: 2 })
  })

  it.each(['lifestyle', 'vehicle'])('alias %sを受理せず入力修正を求める', async (category) => {
    const result = await validateLocalSponsorImportBundle(
      JSON.stringify([validRow({ category })]),
      { imageRoot: fixtureRoot, existingImportIds: [] },
    )
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ field: 'category' })],
    })
  })

  it('複数行・複数fieldのエラーをindex、importId、field、理由で集約する', async () => {
    const outside = path.join(path.dirname(fixtureRoot), 'outside.png')
    writeFileSync(outside, PNG)
    try {
      const result = await validateLocalSponsorImportBundle(
        JSON.stringify([
          validRow({
            importId: 'duplicate',
            category: 'unknown',
            latitude: 91,
            websiteUrl: 'javascript:alert(1)',
            imageFile: 'not-image.txt',
            imageAlt: null,
            order: 1.5,
          }),
          validRow({
            importId: 'duplicate',
            longitude: Number.NaN,
            imageFile: '../outside.png',
          }),
        ]),
        { imageRoot: fixtureRoot, existingImportIds: [] },
      )

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('unreachable')
      expect(result.errors.length).toBeGreaterThanOrEqual(7)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ index: 0, importId: 'duplicate', field: 'importId' }),
          expect.objectContaining({ index: 1, importId: 'duplicate', field: 'importId' }),
          expect.objectContaining({ index: 0, field: 'category' }),
          expect.objectContaining({ index: 0, field: 'latitude' }),
          expect.objectContaining({ index: 0, field: 'websiteUrl' }),
          expect.objectContaining({ index: 0, field: 'imageFile' }),
          expect.objectContaining({ index: 0, field: 'order' }),
          expect.objectContaining({ index: 1, field: 'longitude' }),
          expect.objectContaining({
            index: 1,
            field: 'imageFile',
            reason: expect.stringContaining('root'),
          }),
        ]),
      )
    } finally {
      rmSync(outside, { force: true })
    }
  })

  it('CMS内で同じ取り込みIDが複数存在する状態を拒否する', async () => {
    const result = await validateLocalSponsorImportBundle(
      JSON.stringify([validRow({ imageFile: null, imageAlt: null })]),
      {
        imageRoot: fixtureRoot,
        existingImportIds: ['fixture-001', 'fixture-001'],
      },
    )

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          index: 0,
          importId: 'fixture-001',
          field: 'importId',
          reason: expect.stringContaining('CMS'),
        },
      ],
    })
  })

  it('JSON自体が不正でも書き込み計画を返さない', async () => {
    const result = await validateLocalSponsorImportBundle('{', {
      imageRoot: fixtureRoot,
      existingImportIds: [],
    })
    expect(result).toMatchObject({
      ok: false,
      errors: [{ index: -1, importId: null, field: '$' }],
    })
  })

  it('Payloadのtext制約を書き込み前の全件検証で適用する', async () => {
    const result = await validateLocalSponsorImportBundle(
      JSON.stringify([
        validRow({
          importId: 'i'.repeat(256),
          name: 'n'.repeat(256),
          address: 'a'.repeat(501),
          imageAlt: 'x'.repeat(501),
          phone: '0'.repeat(101),
          websiteUrl: `https://example.invalid/${'p'.repeat(480)}`,
        }),
      ]),
      { imageRoot: fixtureRoot, existingImportIds: [] },
    )

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('unreachable')
    expect(result.errors.map(({ field }) => field)).toEqual(
      expect.arrayContaining(['importId', 'name', 'address', 'imageAlt', 'phone', 'websiteUrl']),
    )
  })
})

type StoredSponsor = Record<string, unknown> & { id: number }

class FixtureStore implements LocalSponsorImportStore<string> {
  sponsors = new Map<number, StoredSponsor>()
  media = new Map<number, Record<string, unknown>>()
  events: string[] = []
  failOnSponsorWrite = false
  failDuringMediaUpload = false
  failOnMediaDelete = false
  failOnRollback = false
  deletedBlobIdentifiers: string[] = []
  storedBlobIdentifiers = new Set<string>()
  private nextSponsorId = 1
  private nextMediaId = 1
  private snapshot: {
    sponsors: Map<number, StoredSponsor>
    media: Map<number, Record<string, unknown>>
  } | null = null

  documents() {
    return [...this.sponsors.values()] as never[]
  }

  async beginTransaction() {
    this.events.push('begin:fixture-tx')
    this.snapshot = {
      sponsors: structuredClone(this.sponsors),
      media: structuredClone(this.media),
    }
    return 'fixture-tx'
  }

  async commitTransaction(transactionId: string) {
    this.events.push(`commit:${transactionId}`)
    this.snapshot = null
  }

  async rollbackTransaction(transactionId: string) {
    this.events.push(`rollback:${transactionId}`)
    if (this.failOnRollback) throw new Error('fixture rollback failure')
    if (this.snapshot) {
      this.sponsors = this.snapshot.sponsors
      this.media = this.snapshot.media
    }
    this.snapshot = null
  }

  async createMedia(
    row: ValidatedLocalSponsorImportRow,
    transactionId: string,
    registerCleanupToken: (token: LocalSponsorMediaCleanupToken) => void,
  ) {
    this.events.push(`media:create:${row.importId}:${transactionId}`)
    const id = this.nextMediaId++
    const blobIdentifiers = [
      `payload-uploads/${row.importId}.webp`,
      `payload-uploads/${row.importId}-thumbnail.webp`,
      `payload-uploads/${row.importId}-card.webp`,
    ]
    const cleanupToken = {
      mediaId: id,
      prefix: 'payload-uploads',
      filenames: blobIdentifiers.map((identifier) => identifier.slice('payload-uploads/'.length)),
      blobIdentifiers,
    }
    registerCleanupToken(cleanupToken)
    this.storedBlobIdentifiers.add(blobIdentifiers[0])
    if (this.failDuringMediaUpload) throw new Error('fixture partial upload failure')
    this.storedBlobIdentifiers.add(blobIdentifiers[1])
    this.storedBlobIdentifiers.add(blobIdentifiers[2])
    this.media.set(id, { id, checksum: row.image?.checksum })
    return {
      id,
      cleanupToken,
    }
  }

  async deleteMediaBlobs(token: LocalSponsorMediaCleanupToken) {
    this.events.push(`media:delete:${token.mediaId}:no-transaction`)
    if (this.failOnMediaDelete) throw new Error('fixture cleanup failure')
    this.deletedBlobIdentifiers.push(...token.blobIdentifiers)
    for (const identifier of token.blobIdentifiers) this.storedBlobIdentifiers.delete(identifier)
    if (token.mediaId !== null) this.media.delete(token.mediaId)
  }

  async createSponsor(data: Record<string, unknown>, transactionId: string) {
    this.events.push(`sponsor:create:${transactionId}`)
    if (this.failOnSponsorWrite) throw new Error('fixture failure')
    const id = this.nextSponsorId++
    this.sponsors.set(id, { id, ...data })
    return id
  }

  async updateSponsor(id: number, data: Record<string, unknown>, transactionId: string) {
    this.events.push(`sponsor:update:${id}:${transactionId}`)
    if (this.failOnSponsorWrite) throw new Error('fixture failure')
    this.sponsors.set(id, { ...this.sponsors.get(id)!, ...data })
  }
}

async function validatedRows(
  rows: readonly Record<string, unknown>[],
): Promise<readonly ValidatedLocalSponsorImportRow[]> {
  const result = await validateLocalSponsorImportBundle(JSON.stringify(rows), {
    imageRoot: fixtureRoot,
    existingImportIds: [],
  })
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.rows
}

describe('create/apply local sponsor import plan', () => {
  it('同じ入力を2回適用してもSponsorとMediaが増えない', async () => {
    const store = new FixtureStore()
    const rows = await validatedRows([validRow()])

    const first = createLocalSponsorImportPlan(rows, store.documents())
    expect(first.counts).toEqual({ create: 1, update: 0, unchanged: 0 })
    await applyLocalSponsorImportPlan(first, store)
    expect([store.sponsors.size, store.media.size]).toEqual([1, 1])

    const second = createLocalSponsorImportPlan(rows, store.documents())
    expect(second.counts).toEqual({ create: 0, update: 0, unchanged: 1 })
    await applyLocalSponsorImportPlan(second, store)
    expect([store.sponsors.size, store.media.size]).toEqual([1, 1])
  })

  it('同じchecksumの画像を複数行で共有してもuploadは1回だけ行う', async () => {
    const store = new FixtureStore()
    const rows = await validatedRows([
      validRow(),
      validRow({ importId: 'fixture-002', name: 'テスト専用地域協賛2' }),
    ])

    await applyLocalSponsorImportPlan(createLocalSponsorImportPlan(rows, []), store)

    expect(store.sponsors.size).toBe(2)
    expect(store.media.size).toBe(1)
    expect(store.events.filter((event) => event.startsWith('media:create:'))).toHaveLength(1)
  })

  it('新規orderだけを既存Sponsorの最大_orderより後ろで数値順に並べる', async () => {
    const rows = await validatedRows([
      validRow({ importId: 'fixture-002', order: 20 }),
      validRow({ importId: 'fixture-001', order: -4 }),
      validRow({ importId: 'fixture-003', order: null }),
    ])

    const plan = createLocalSponsorImportPlan(rows, [
      {
        id: 99,
        type: ['ad', 'vendor'],
        name: '既存協賛',
        _order: 'a5',
        updatedAt: 'fixture',
        createdAt: 'fixture',
      } as never,
    ])
    const keys = new Map(plan.actions.map(({ row, data }) => [row.importId, data._order as string]))

    expect(keys.get('fixture-001')).toBeDefined()
    expect(keys.get('fixture-002')).toBeDefined()
    expect(keys.get('fixture-003')).toBeDefined()
    expect(keys.get('fixture-001')! > 'a5').toBe(true)
    expect(keys.get('fixture-002')! > keys.get('fixture-001')!).toBe(true)
    expect(keys.get('fixture-003')! > keys.get('fixture-002')!).toBe(true)
  })

  it('既存の取り込み対象の_orderを更新せず再適用を変更なしにする', async () => {
    const store = new FixtureStore()
    const rows = await validatedRows([validRow({ imageFile: null, imageAlt: null, order: 1 })])
    store.sponsors.set(9, {
      id: 9,
      ...createLocalSponsorImportPlan(rows, []).actions[0].data,
      local_image: null,
      _order: 'z1',
    })

    const plan = createLocalSponsorImportPlan(rows, store.documents())

    expect(plan.counts).toEqual({ create: 0, update: 0, unchanged: 1 })
    expect(plan.actions[0].data).not.toHaveProperty('_order')
  })

  it('更新時に複数typeと広告・出店固有項目を保持し、同checksum画像を再利用する', async () => {
    const store = new FixtureStore()
    const rows = await validatedRows([validRow({ name: '更新後' })])
    const checksum = rows[0].image!.checksum
    store.media.set(7, { id: 7, checksum })
    store.sponsors.set(9, {
      id: 9,
      type: ['ad', 'local', 'vendor'],
      name: '更新前',
      local_import_id: 'fixture-001',
      local_image: 7,
      local_image_checksum: checksum,
      logo: 99,
      tier: 'planA',
      area_id: 3,
      booth_number: 'V-1',
      updatedAt: 'fixture',
      createdAt: 'fixture',
    })

    const plan = createLocalSponsorImportPlan(rows, store.documents())
    expect(plan.actions[0]).toMatchObject({
      kind: 'update',
      image: { kind: 'reuse', mediaId: 7 },
    })
    await applyLocalSponsorImportPlan(plan, store)

    expect(store.sponsors.get(9)).toMatchObject({
      type: ['ad', 'local', 'vendor'],
      name: '更新後',
      local_image: 7,
      logo: 99,
      tier: 'planA',
      area_id: 3,
      booth_number: 'V-1',
    })
    expect(store.media.size).toBe(1)
  })

  it('途中失敗時にtransactionをrollbackしてから新規blobをtransactionなしで補償削除する', async () => {
    const store = new FixtureStore()
    store.failOnSponsorWrite = true
    const rows = await validatedRows([validRow()])
    const plan = createLocalSponsorImportPlan(rows, [])

    await expect(applyLocalSponsorImportPlan(plan, store)).rejects.toThrow('fixture failure')
    expect(store.sponsors.size).toBe(0)
    expect(store.media.size).toBe(0)
    expect(store.events).toEqual([
      'begin:fixture-tx',
      'media:create:fixture-001:fixture-tx',
      'sponsor:create:fixture-tx',
      'rollback:fixture-tx',
      'media:delete:1:no-transaction',
    ])
    expect(store.deletedBlobIdentifiers).toEqual([
      'payload-uploads/fixture-001.webp',
      'payload-uploads/fixture-001-thumbnail.webp',
      'payload-uploads/fixture-001-card.webp',
    ])
  })

  it('Media uploadが派生画像の途中で失敗しても先に登録した全予定keyをrollback後に削除する', async () => {
    const store = new FixtureStore()
    store.failDuringMediaUpload = true
    const rows = await validatedRows([validRow()])

    await expect(
      applyLocalSponsorImportPlan(createLocalSponsorImportPlan(rows, []), store),
    ).rejects.toThrow('fixture partial upload failure')

    expect(store.events.slice(-2)).toEqual(['rollback:fixture-tx', 'media:delete:1:no-transaction'])
    expect(store.deletedBlobIdentifiers).toEqual([
      'payload-uploads/fixture-001.webp',
      'payload-uploads/fixture-001-thumbnail.webp',
      'payload-uploads/fixture-001-card.webp',
    ])
    expect(store.storedBlobIdentifiers).toEqual(new Set())
  })

  it('補償削除失敗時は対象Media IDを監査可能な例外に残す', async () => {
    const store = new FixtureStore()
    store.failOnSponsorWrite = true
    store.failOnMediaDelete = true
    const rows = await validatedRows([validRow()])

    await expect(
      applyLocalSponsorImportPlan(createLocalSponsorImportPlan(rows, []), store),
    ).rejects.toThrow(/payload-uploads\/fixture-001\.webp/)
    expect(store.events.slice(-2)).toEqual(['rollback:fixture-tx', 'media:delete:1:no-transaction'])
  })

  it('rollback失敗時はblobを削除せず具体的な未削除対象を報告する', async () => {
    const store = new FixtureStore()
    store.failOnSponsorWrite = true
    store.failOnRollback = true
    const rows = await validatedRows([validRow()])

    await expect(
      applyLocalSponsorImportPlan(createLocalSponsorImportPlan(rows, []), store),
    ).rejects.toThrow(/rollback.*payload-uploads\/fixture-001\.webp/)
    expect(store.events).not.toContain('media:delete:1:no-transaction')
    expect(store.deletedBlobIdentifiers).toEqual([])
  })

  it('入力から消えた既存行を削除せずmissingとして報告する', async () => {
    const rows = await validatedRows([validRow({ imageFile: null, imageAlt: null })])
    const plan = createLocalSponsorImportPlan(rows, [
      {
        id: 8,
        type: ['local'],
        name: '入力外fixture',
        local_import_id: 'fixture-missing',
        updatedAt: 'fixture',
        createdAt: 'fixture',
      } as never,
    ])
    expect(plan.missingImportIds).toEqual(['fixture-missing'])
    expect(plan.actions).not.toContainEqual(expect.objectContaining({ kind: 'delete' }))
  })
})

describe('local sponsor import CLI', () => {
  it('既定をdry-runにし、--applyと--expected-countを明示解析する', () => {
    expect(parseLocalSponsorImportArgs(['--input', 'bundle.json', '--images', 'images'])).toEqual({
      inputPath: 'bundle.json',
      imageRoot: 'images',
      apply: false,
      expectedCount: null,
    })
    expect(
      parseLocalSponsorImportArgs([
        '--input',
        'bundle.json',
        '--images',
        'images',
        '--apply',
        '--expected-count',
        '34',
      ]),
    ).toMatchObject({ apply: true, expectedCount: 34 })
  })

  it('dry-runはtransactionを開始せず差分・掲載可能件数・確認対象を返す', async () => {
    const store = new FixtureStore()
    const report = await runLocalSponsorImport({
      json: JSON.stringify([validRow()]),
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: false,
      expectedCount: null,
      bundleFiles: [{ path: 'input/bundle.json', sha256: 'a'.repeat(64), bytes: 10 }],
    })

    expect(report).toMatchObject({
      status: 'ok',
      mode: 'dry-run',
      inputCount: 1,
      publishableCount: 1,
      counts: { create: 1, update: 0, unchanged: 0, error: 0 },
      imageDiff: { upload: 1, reuse: 0, none: 0 },
      importIds: ['fixture-001'],
      checks: {
        pins: ['fixture-001'],
        images: ['fixture-001'],
        links: ['fixture-001'],
      },
      bundleFiles: [{ path: 'input/bundle.json', sha256: 'a'.repeat(64), bytes: 10 }],
    })
    expect(store.events).toEqual([])
  })

  it('--applyのときだけtransactionを開始して適用する', async () => {
    const store = new FixtureStore()
    const report = await runLocalSponsorImport({
      json: JSON.stringify([validRow()]),
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: true,
      expectedCount: 1,
      bundleFiles: [],
    })
    expect(report).toMatchObject({ status: 'ok', mode: 'apply' })
    expect(store.events).toEqual([
      'begin:fixture-tx',
      'media:create:fixture-001:fixture-tx',
      'sponsor:create:fixture-tx',
      'commit:fixture-tx',
    ])
  })

  it('--applyはS3_BUCKET未設定をPayload初期化前に拒否する', () => {
    expect(() => ensureRemoteStorageForApply(false, {})).not.toThrow()
    expect(() => ensureRemoteStorageForApply(true, {})).toThrow(/S3_BUCKET/)
    expect(() => ensureRemoteStorageForApply(true, { S3_BUCKET: '   ' })).toThrow(/S3_BUCKET/)
    expect(() => ensureRemoteStorageForApply(true, { S3_BUCKET: 'test-bucket' })).not.toThrow()
  })

  it('CLI entrypointはS3_BUCKETなしの--applyでPayload loaderを呼ばない', async () => {
    const loadPayload = vi.fn()

    await expect(
      runLocalSponsorImportMain({
        args: ['--input', 'bundle.json', '--images', 'images', '--apply'],
        environment: {},
        loadPayload,
      }),
    ).rejects.toThrow(/S3_BUCKET/)
    expect(loadPayload).not.toHaveBeenCalled()
  })

  it('Payloadの命名規則で原本と全派生画像をupload開始前にcleanup tokenへ登録する', async () => {
    const deleteStorageBlobs = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn().mockResolvedValue({ id: 7 })
    const payload = {
      collections: {
        media: {
          config: {
            fields: [{ name: 'prefix', defaultValue: 'payload-uploads' }],
            upload: {
              staticDir: path.join(fixtureRoot, 'media'),
              formatOptions: { format: 'webp', options: { quality: 82 } },
              imageSizes: [
                {
                  name: 'thumbnail',
                  width: 320,
                  withoutEnlargement: true,
                  formatOptions: { format: 'webp', options: { quality: 82 } },
                },
                {
                  name: 'hero',
                  width: 1920,
                  withoutEnlargement: true,
                  formatOptions: { format: 'webp', options: { quality: 82 } },
                },
                {
                  name: 'card',
                  width: 960,
                  withoutEnlargement: true,
                  formatOptions: { format: 'webp', options: { quality: 82 } },
                },
              ],
            },
          },
        },
      },
      config: { sharp },
      db: { findOne: vi.fn().mockResolvedValue(null) },
      create,
    } as never
    const uploadStorageBlobs = vi.fn().mockResolvedValue(undefined)
    const store = new PayloadLocalSponsorImportStore(
      payload,
      deleteStorageBlobs,
      uploadStorageBlobs,
    )
    const rows = await validatedRows([validRow()])
    const registerCleanupToken = vi.fn()
    const base = `local-sponsor-${rows[0].image!.checksum}`

    const created = await store.createMedia(rows[0], 'fixture-tx', registerCleanupToken)
    await store.deleteMediaBlobs(created.cleanupToken)

    expect(created.cleanupToken.blobIdentifiers).toEqual([
      `payload-uploads/${base}.webp`,
      `payload-uploads/${base}-320x160.webp`,
      `payload-uploads/${base}-1920x960.webp`,
      `payload-uploads/${base}-960x480.webp`,
    ])
    expect(registerCleanupToken).toHaveBeenCalledBefore(create)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ name: `${base}.webp` }),
        overwriteExistingFiles: true,
        req: expect.objectContaining({ transactionID: 'fixture-tx' }),
      }),
    )
    expect(deleteStorageBlobs).toHaveBeenCalledWith(created.cleanupToken)
    expect(uploadStorageBlobs).toHaveBeenCalledWith(
      { id: 7 },
      expect.objectContaining({ context: { skipCloudStorage: true } }),
      created.cleanupToken,
    )
    expect((payload as { findByID?: unknown }).findByID).toBeUndefined()
    expect((payload as { delete?: unknown }).delete).toBeUndefined()
  })

  it('実際のS3 Media afterDelete hookをfresh req・transactionなしで通して全blobを削除する', async () => {
    const handle = vi.fn().mockResolvedValue({
      response: { statusCode: 204, headers: {}, body: undefined },
    })
    const configured = s3Storage({
      bucket: 'fixture-bucket',
      clientCacheKey: `cleanup-success-${crypto.randomUUID()}`,
      collections: { media: { prefix: 'payload-uploads' } },
      config: {
        endpoint: 'http://127.0.0.1:1',
        region: 'auto',
        credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
        requestHandler: { handle },
      } as never,
    })({
      admin: { user: 'users' },
      collections: [Media],
      i18n: { fallbackLanguage: 'en', supportedLanguages: { en } },
      serverURL: 'http://localhost:3000',
    } as never)
    const payload = {
      config: configured,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    } as never
    const previousRequest = { transactionID: 'rolled-back' }
    const token: LocalSponsorMediaCleanupToken = {
      mediaId: null,
      prefix: 'payload-uploads',
      filenames: ['source.webp', 'source-320x160.webp', 'source-1920x960.webp'],
      blobIdentifiers: [
        'payload-uploads/source.webp',
        'payload-uploads/source-320x160.webp',
        'payload-uploads/source-1920x960.webp',
      ],
    }

    const cleanupRequest = await deletePayloadStorageBlobs(payload, token)

    expect(cleanupRequest).not.toBe(previousRequest)
    expect(cleanupRequest.transactionID).toBeUndefined()
    expect(handle).toHaveBeenCalledTimes(3)
    const requestPaths = handle.mock.calls.map(([request]) => decodeURIComponent(request.path))
    expect(requestPaths).toEqual(
      expect.arrayContaining(token.filenames.map((filename) => expect.stringContaining(filename))),
    )
  })

  it('実際のS3 Media afterDelete hookがloggerへ吸収した失敗をblob識別子付きAggregateErrorへ昇格する', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('fixture S3 delete failure'))
    const configured = s3Storage({
      bucket: 'fixture-bucket',
      clientCacheKey: `cleanup-failure-${crypto.randomUUID()}`,
      collections: { media: { prefix: 'payload-uploads' } },
      config: {
        endpoint: 'http://127.0.0.1:1',
        region: 'auto',
        credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
        requestHandler: { handle },
      } as never,
    })({
      admin: { user: 'users' },
      collections: [Media],
      i18n: { fallbackLanguage: 'en', supportedLanguages: { en } },
      serverURL: 'http://localhost:3000',
    } as never)
    const payload = {
      config: configured,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    } as never
    const token: LocalSponsorMediaCleanupToken = {
      mediaId: null,
      prefix: 'payload-uploads',
      filenames: ['source.webp', 'source-320x160.webp'],
      blobIdentifiers: ['payload-uploads/source.webp', 'payload-uploads/source-320x160.webp'],
    }

    const failure = await deletePayloadStorageBlobs(payload, token).catch((error) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect(failure.message).toContain('payload-uploads/source.webp')
    expect(failure.message).toContain('payload-uploads/source-320x160.webp')
  })

  it('PUT失敗後に遅延PUTが完了するまで待ってrollback後の補償削除でblobを空にする', async () => {
    const token: LocalSponsorMediaCleanupToken = {
      mediaId: 7,
      prefix: 'payload-uploads',
      filenames: [
        'source.webp',
        'source-320x160.webp',
        'source-1920x960.webp',
        'source-960x480.webp',
      ],
      blobIdentifiers: [
        'payload-uploads/source.webp',
        'payload-uploads/source-320x160.webp',
        'payload-uploads/source-1920x960.webp',
        'payload-uploads/source-960x480.webp',
      ],
    }
    const blobs = new Set<string>()
    let delayedPutFinished = false
    const handle = vi.fn().mockImplementation(async (request: { method: string; path: string }) => {
      const requestPath = decodeURIComponent(request.path)
      const filename = token.filenames.find((candidate) => requestPath.includes(candidate))
      if (!filename) throw new Error(`unexpected S3 path: ${requestPath}`)
      const identifier = `payload-uploads/${filename}`
      if (request.method === 'PUT') {
        if (filename === 'source-320x160.webp') throw new Error('fixture PUT failure')
        if (filename === 'source-1920x960.webp') {
          await new Promise((resolve) => setTimeout(resolve, 25))
          delayedPutFinished = true
        }
        blobs.add(identifier)
        return { response: { statusCode: 200, headers: {}, body: undefined } }
      }
      if (request.method === 'DELETE') {
        blobs.delete(identifier)
        return { response: { statusCode: 204, headers: {}, body: undefined } }
      }
      throw new Error(`unexpected S3 method: ${request.method}`)
    })
    const configured = s3Storage({
      bucket: 'fixture-bucket',
      clientCacheKey: `upload-race-${crypto.randomUUID()}`,
      collections: { media: { prefix: 'payload-uploads' } },
      config: {
        endpoint: 'http://127.0.0.1:1',
        region: 'auto',
        credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
        requestHandler: { handle },
      } as never,
    })({
      admin: { user: 'users' },
      collections: [Media],
      i18n: { fallbackLanguage: 'en', supportedLanguages: { en } },
      serverURL: 'http://localhost:3000',
    } as never)
    const payload = {
      config: configured,
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    } as never
    const media = {
      id: 7,
      prefix: 'payload-uploads',
      filename: 'source.webp',
      mimeType: 'image/webp',
      sizes: {
        thumbnail: { filename: 'source-320x160.webp', mimeType: 'image/webp' },
        hero: { filename: 'source-1920x960.webp', mimeType: 'image/webp' },
        card: { filename: 'source-960x480.webp', mimeType: 'image/webp' },
      },
    } as never
    const original = {
      name: 'source.webp',
      data: Buffer.from('original'),
      mimetype: 'image/webp',
      size: 8,
    }
    const sourceRequest = {
      context: {
        _payloadCloudStorage: {
          file: original,
          uploadSizes: {
            thumbnail: Buffer.from('thumbnail'),
            hero: Buffer.from('hero'),
            card: Buffer.from('card'),
          },
        },
      },
      payload,
      transactionID: 'fixture-tx',
    } as never
    const events: string[] = []
    const store: LocalSponsorImportStore<string> = {
      beginTransaction: async () => {
        events.push('begin')
        return 'fixture-tx'
      },
      commitTransaction: async () => {
        events.push('commit')
      },
      rollbackTransaction: async () => {
        events.push('rollback')
      },
      createMedia: async (_row, _transactionId, registerCleanupToken) => {
        registerCleanupToken(token)
        events.push('upload')
        await uploadPayloadStorageBlobs(payload, media, sourceRequest, token)
        return { id: 7, cleanupToken: token }
      },
      deleteMediaBlobs: async (cleanupToken) => {
        events.push('cleanup')
        await deletePayloadStorageBlobs(payload, cleanupToken)
      },
      createSponsor: async () => 1,
      updateSponsor: async () => undefined,
    }
    const rows = await validatedRows([validRow()])

    await expect(
      applyLocalSponsorImportPlan(createLocalSponsorImportPlan(rows, []), store),
    ).rejects.toThrow(/payload-uploads\/source-320x160\.webp/)

    expect(delayedPutFinished).toBe(true)
    expect(events).toEqual(['begin', 'upload', 'rollback', 'cleanup'])
    expect(blobs).toEqual(new Set())
  })

  it('dry-runとapplyの両方でPayload入力制約を同じく適用する', async () => {
    const store = new FixtureStore()
    const input = JSON.stringify([validRow({ name: 'n'.repeat(256) })])

    const dryRun = await runLocalSponsorImport({
      json: input,
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: false,
      expectedCount: null,
      bundleFiles: [],
    })
    const apply = await runLocalSponsorImport({
      json: input,
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: true,
      expectedCount: null,
      bundleFiles: [],
    })

    expect(dryRun).toMatchObject({ status: 'error', errors: [{ field: 'name' }] })
    expect(apply).toMatchObject({ status: 'error', errors: [{ field: 'name' }] })
    expect(store.events).toEqual([])
  })

  it('検証失敗またはexpected count不一致なら終了用error reportを返し書き込まない', async () => {
    const store = new FixtureStore()
    const invalid = await runLocalSponsorImport({
      json: JSON.stringify([validRow({ category: 'unknown' })]),
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: true,
      expectedCount: null,
      bundleFiles: [],
    })
    const countMismatch = await runLocalSponsorImport({
      json: JSON.stringify([validRow()]),
      imageRoot: fixtureRoot,
      existingSponsors: [],
      store,
      apply: true,
      expectedCount: 34,
      bundleFiles: [],
    })

    expect(invalid).toMatchObject({
      status: 'error',
      counts: { error: 1 },
    })
    expect(countMismatch).toMatchObject({
      status: 'error',
      errors: [{ field: '$count' }],
    })
    expect(store.events).toEqual([])
  })

  it('入力JSONと画像directoryのファイル一覧・SHA-256を決定的に作る', async () => {
    const inputPath = path.join(path.dirname(fixtureRoot), `${path.basename(fixtureRoot)}.json`)
    writeFileSync(inputPath, '[]')
    try {
      const manifest = await createBundleManifest(inputPath, fixtureRoot)

      expect(manifest.map(({ path: file }) => file)).toEqual([
        'images/not-image.txt',
        'images/sample.png',
        `input/${path.basename(inputPath)}`,
      ])
      expect(manifest.every(({ sha256 }) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true)
    } finally {
      rmSync(inputPath, { force: true })
    }
  })
})
