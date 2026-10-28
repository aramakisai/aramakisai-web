import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createBundleManifest,
  PayloadLocalSponsorImportStore,
  runLocalSponsorImport,
} from './import-local-sponsors'
import {
  applyLocalSponsorImportPlan,
  createLocalSponsorImportPlan,
  type LocalSponsorImportStore,
  type ValidatedLocalSponsorImportRow,
} from './local-sponsor-import'

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)
const execFileAsync = promisify(execFile)
const cmsRoot = path.resolve(import.meta.dirname, '..')

async function runCli(args: readonly string[]) {
  const pnpmArgs = ['run', 'import:local-sponsors', ...args]
  if (process.platform === 'win32') {
    return execFileAsync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'pnpm', ...pnpmArgs],
      {
        cwd: cmsRoot,
        env: process.env,
        timeout: 180_000,
      },
    )
  }
  return execFileAsync('pnpm', pnpmArgs, {
    cwd: cmsRoot,
    env: process.env,
    timeout: 180_000,
  })
}

type CliFailure = Error & {
  readonly code?: number | string
  readonly stdout?: string
}

describe.skipIf(!hasDatabase)('local sponsor import Payload integration', () => {
  let payload!: Payload

  beforeAll(async () => {
    vi.stubEnv('S3_BUCKET', 'ci-local-sponsor-integration')
    vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:1')
    vi.stubEnv('S3_REGION', 'ci-local-sponsor-integration')
    vi.stubEnv('S3_ACCESS_KEY_ID', 'ci-local-sponsor-integration')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'ci-local-sponsor-integration')
    const { getPayload } = await import('payload')
    const config = (await import('../src/payload.config')).default
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    if (payload) await payload.destroy()
    vi.unstubAllEnvs()
  })

  it('package scriptでdry-run、apply、同一bundleの再適用を検証する', async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'local-sponsor-int-'))
    const inputPath = path.join(fixtureRoot, 'bundle.json')
    const importId = `integration-fixture-${process.pid}-${Date.now()}`
    let sponsorId: number | null = null

    try {
      const json = JSON.stringify([
        {
          importId,
          name: '統合テスト専用地域協賛',
          category: 'hospital',
          latitude: 36.4,
          longitude: 139.1,
          address: null,
          imageFile: null,
          imageAlt: null,
          imageDecorative: false,
          message: null,
          businessHours: null,
          closedDays: null,
          phone: null,
          websiteUrl: null,
          order: null,
        },
      ])
      await writeFile(inputPath, json)
      const bundleFiles = await createBundleManifest(inputPath, fixtureRoot)
      const store = new PayloadLocalSponsorImportStore(payload)
      const existing = async () =>
        (
          await payload.find({
            collection: 'sponsors',
            depth: 0,
            limit: 0,
            pagination: false,
            overrideAccess: true,
          })
        ).docs

      const cliArgs = ['--input', inputPath, '--images', fixtureRoot, '--expected-count', '1']
      const dryRun = await runCli(cliArgs)
      expect(dryRun.stdout).toContain('"mode": "dry-run"')
      expect(dryRun.stdout).toContain('"create": 1')
      expect(
        await payload.count({
          collection: 'sponsors',
          overrideAccess: true,
          where: { local_import_id: { equals: importId } },
        }),
      ).toMatchObject({ totalDocs: 0 })

      const applied = await runCli([...cliArgs, '--apply'])
      expect(applied.stdout).toContain('"mode": "apply"')
      expect(applied.stdout).toContain('"create": 1')

      const matches = await payload.find({
        collection: 'sponsors',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { local_import_id: { equals: importId } },
      })
      expect(matches.docs).toHaveLength(1)
      sponsorId = matches.docs[0].id

      const repeated = await runLocalSponsorImport({
        json,
        imageRoot: fixtureRoot,
        existingSponsors: await existing(),
        store,
        apply: true,
        expectedCount: 1,
        bundleFiles,
      })
      expect(repeated).toMatchObject({
        status: 'ok',
        counts: { create: 0, update: 0, unchanged: 1 },
      })
    } finally {
      if (sponsorId !== null) {
        await payload.delete({
          collection: 'sponsors',
          id: sponsorId,
          overrideAccess: true,
        })
      }
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }, 240_000)

  it('検証失敗は終了コード1かつ書き込み0件になる', async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'local-sponsor-invalid-int-'))
    const inputPath = path.join(fixtureRoot, 'bundle.json')
    const importId = `invalid-integration-fixture-${process.pid}-${Date.now()}`
    try {
      await writeFile(
        inputPath,
        JSON.stringify([
          {
            importId,
            name: '検証失敗テスト専用地域協賛',
            category: 'hospital',
            latitude: 36.4,
            longitude: 139.1,
            address: null,
            imageFile: null,
            imageAlt: null,
            imageDecorative: false,
            message: null,
            businessHours: null,
            closedDays: null,
            phone: null,
            websiteUrl: null,
            order: null,
          },
        ]),
      )

      let failure: CliFailure | null = null
      try {
        await runCli(['--input', inputPath, '--images', fixtureRoot, '--expected-count', '2'])
      } catch (error) {
        failure = error as CliFailure
      }
      expect(failure).toMatchObject({ code: 1 })
      expect(failure?.stdout).toContain('"status": "error"')
      expect(
        await payload.count({
          collection: 'sponsors',
          overrideAccess: true,
          where: { local_import_id: { equals: importId } },
        }),
      ).toMatchObject({ totalDocs: 0 })
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }, 180_000)

  it('途中失敗時にtransactionと新規Mediaをrollbackする', async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'local-sponsor-rollback-int-'))
    const imagePath = path.join(fixtureRoot, 'fixture.png')
    const importId = `rollback-integration-fixture-${process.pid}-${Date.now()}`
    const imageAlt = `rollback fixture ${importId}`
    let deleteMediaCalls = 0

    try {
      await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 4,
          background: '#ffffff',
        },
      })
        .png()
        .toFile(imagePath)
      const row: ValidatedLocalSponsorImportRow = {
        importId,
        name: 'rollbackテスト専用地域協賛',
        category: 'hospital',
        latitude: 36.4,
        longitude: 139.1,
        address: null,
        image: {
          relativePath: 'fixture.png',
          absolutePath: imagePath,
          mimeType: 'image/png',
          checksum: 'f'.repeat(64),
        },
        imageAlt,
        imageDecorative: false,
        message: null,
        businessHours: null,
        closedDays: null,
        phone: null,
        websiteUrl: null,
        order: null,
      }
      const delegate = new PayloadLocalSponsorImportStore(
        payload,
        async () => undefined,
        async () => undefined,
      )
      const failingStore: LocalSponsorImportStore<string | number> = {
        beginTransaction: () => delegate.beginTransaction(),
        commitTransaction: (transactionId) => delegate.commitTransaction(transactionId),
        rollbackTransaction: (transactionId) => delegate.rollbackTransaction(transactionId),
        createMedia: (input, transactionId, registerCleanupToken) =>
          delegate.createMedia(input, transactionId, registerCleanupToken),
        deleteMediaBlobs: async (token) => {
          deleteMediaCalls += 1
          await delegate.deleteMediaBlobs(token)
        },
        createSponsor: async (data, transactionId) => {
          await delegate.createSponsor(data, transactionId)
          throw new Error('forced integration failure')
        },
        updateSponsor: (id, data, transactionId) => delegate.updateSponsor(id, data, transactionId),
      }

      await expect(
        applyLocalSponsorImportPlan(createLocalSponsorImportPlan([row], []), failingStore),
      ).rejects.toThrow('forced integration failure')
      expect(deleteMediaCalls).toBe(1)
      expect(
        await payload.count({
          collection: 'sponsors',
          overrideAccess: true,
          where: { local_import_id: { equals: importId } },
        }),
      ).toMatchObject({ totalDocs: 0 })
      expect(
        await payload.count({
          collection: 'media',
          overrideAccess: true,
          where: { alt: { equals: imageAlt } },
        }),
      ).toMatchObject({ totalDocs: 0 })
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }, 120_000)

  it('匿名readを許可し、地域協賛の取り込みで既存3種を変更しない', async () => {
    const suffix = `${process.pid}-${Date.now()}`
    const createdIds: number[] = []
    const importId = `public-read-fixture-${suffix}`

    try {
      const existing = await Promise.all([
        payload.create({
          collection: 'sponsors',
          data: { name: `広告協賛fixture-${suffix}`, type: ['ad'], tier: 'planA' },
          overrideAccess: true,
        }),
        payload.create({
          collection: 'sponsors',
          data: {
            name: `出店協賛fixture-${suffix}`,
            type: ['vendor'],
            booth_label: '既存出店表示',
          },
          overrideAccess: true,
        }),
        payload.create({
          collection: 'sponsors',
          data: {
            name: `その他協賛fixture-${suffix}`,
            type: ['other'],
            description: '既存その他説明',
          },
          overrideAccess: true,
        }),
      ])
      createdIds.push(...existing.map(({ id }) => id))
      const before = existing.map(({ id, name, type, tier, booth_label, description }) => ({
        id,
        name,
        type,
        tier,
        booth_label,
        description,
      }))
      const row: ValidatedLocalSponsorImportRow = {
        importId,
        name: '公開read統合テスト専用地域協賛',
        category: 'life',
        latitude: 36.4,
        longitude: 139.1,
        address: 'テスト専用住所',
        image: null,
        imageAlt: null,
        imageDecorative: false,
        message: null,
        businessHours: null,
        closedDays: null,
        phone: null,
        websiteUrl: null,
        order: null,
      }

      const allBefore = await payload.find({
        collection: 'sponsors',
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      await applyLocalSponsorImportPlan(
        createLocalSponsorImportPlan([row], allBefore.docs),
        new PayloadLocalSponsorImportStore(payload),
      )
      const local = await payload.find({
        collection: 'sponsors',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { local_import_id: { equals: importId } },
      })
      expect(local.docs).toHaveLength(1)
      createdIds.push(local.docs[0].id)

      const anonymousRead = await payload.find({
        collection: 'sponsors',
        depth: 0,
        pagination: false,
        overrideAccess: false,
        where: { id: { in: createdIds } },
      })
      expect(anonymousRead.docs.map(({ id }) => id).sort()).toEqual(createdIds.slice().sort())
      expect(anonymousRead.docs.find(({ id }) => id === local.docs[0].id)).toMatchObject({
        name: row.name,
        type: ['local'],
        local_map_category: 'life',
        local_latitude: 36.4,
        local_longitude: 139.1,
      })

      const after = await Promise.all(
        existing.map(({ id }) =>
          payload.findByID({
            collection: 'sponsors',
            id,
            depth: 0,
            overrideAccess: true,
          }),
        ),
      )
      expect(
        after.map(({ id, name, type, tier, booth_label, description }) => ({
          id,
          name,
          type,
          tier,
          booth_label,
          description,
        })),
      ).toEqual(before)
    } finally {
      await Promise.all(
        createdIds.map((id) =>
          payload.delete({ collection: 'sponsors', id, overrideAccess: true }).catch(() => null),
        ),
      )
    }
  }, 120_000)
})
