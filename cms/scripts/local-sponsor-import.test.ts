import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  applyLocalSponsorImportPlan,
  createLocalSponsorImportPlan,
  type LocalSponsorImportStore,
  validateLocalSponsorImportBundle,
  type ValidatedLocalSponsorImportRow,
} from './local-sponsor-import'
import {
  createBundleManifest,
  parseLocalSponsorImportArgs,
  runLocalSponsorImport,
} from './import-local-sponsors'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

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
})

type StoredSponsor = Record<string, unknown> & { id: number }

class FixtureStore implements LocalSponsorImportStore<string> {
  sponsors = new Map<number, StoredSponsor>()
  media = new Map<number, Record<string, unknown>>()
  events: string[] = []
  failOnSponsorWrite = false
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
    if (this.snapshot) {
      this.sponsors = this.snapshot.sponsors
      this.media = this.snapshot.media
    }
    this.snapshot = null
  }

  async createMedia(row: ValidatedLocalSponsorImportRow, transactionId: string) {
    this.events.push(`media:create:${row.importId}:${transactionId}`)
    const id = this.nextMediaId++
    this.media.set(id, { id, checksum: row.image?.checksum })
    return id
  }

  async deleteMedia(id: number, transactionId: string) {
    this.events.push(`media:delete:${id}:${transactionId}`)
    this.media.delete(id)
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

  it('orderをPayload互換のfractional indexへ変換して数値順に並べる', async () => {
    const rows = await validatedRows([
      validRow({ importId: 'fixture-002', order: 20 }),
      validRow({ importId: 'fixture-001', order: -4 }),
    ])

    const plan = createLocalSponsorImportPlan(rows, [])
    const keys = new Map(plan.actions.map(({ row, data }) => [row.importId, data._order as string]))

    expect(keys.get('fixture-001')).toBe('a0')
    expect(keys.get('fixture-002')).toBe('a1')
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

  it('途中失敗時に新規blobを補償削除してtransactionをrollbackする', async () => {
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
      'media:delete:1:fixture-tx',
      'rollback:fixture-tx',
    ])
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
