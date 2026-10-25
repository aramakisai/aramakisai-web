import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Payload, PayloadRequest } from 'payload'

import type { Sponsor } from '../src/payload-types'
import {
  applyLocalSponsorImportPlan,
  createLocalSponsorImportPlan,
  type LocalSponsorImportError,
  type LocalSponsorImportStore,
  validateLocalSponsorImportBundle,
  type ValidatedLocalSponsorImportRow,
} from './local-sponsor-import'

export interface LocalSponsorImportCliOptions {
  readonly inputPath: string
  readonly imageRoot: string
  readonly apply: boolean
  readonly expectedCount: number | null
}

export interface BundleFile {
  readonly path: string
  readonly sha256: string
  readonly bytes: number
}

export function parseLocalSponsorImportArgs(args: readonly string[]): LocalSponsorImportCliOptions {
  let inputPath: string | null = null
  let imageRoot: string | null = null
  let apply = false
  let expectedCount: number | null = null
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--apply') {
      apply = true
    } else if (arg === '--input' || arg === '--images' || arg === '--expected-count') {
      const value = args[index + 1]
      if (!value) throw new Error(`${arg} に値が必要です`)
      index += 1
      if (arg === '--input') inputPath = value
      if (arg === '--images') imageRoot = value
      if (arg === '--expected-count') {
        expectedCount = Number(value)
        if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
          throw new Error('--expected-count は0以上の整数にしてください')
        }
      }
    } else {
      throw new Error(`不明なオプションです: ${arg}`)
    }
  }
  if (!inputPath || !imageRoot) {
    throw new Error('--input と --images は必須です')
  }
  return { inputPath, imageRoot, apply, expectedCount }
}

async function filesUnder(root: string): Promise<string[]> {
  const result: string[] = []
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile()) result.push(absolute)
    }
  }
  await visit(root)
  return result
}

export async function createBundleManifest(
  inputPath: string,
  imageRoot: string,
): Promise<readonly BundleFile[]> {
  const resolvedInput = path.resolve(inputPath)
  const resolvedImages = path.resolve(imageRoot)
  const files = new Map<string, string>()
  for (const file of await filesUnder(resolvedImages)) {
    const relative = path.relative(resolvedImages, file).split(path.sep).join('/')
    files.set(path.resolve(file), `images/${relative}`)
  }
  files.set(resolvedInput, `input/${path.basename(resolvedInput)}`)

  const manifest = await Promise.all(
    [...files].map(async ([absolute, displayPath]) => {
      const buffer = await readFile(absolute)
      return {
        path: displayPath,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        bytes: buffer.byteLength,
      }
    }),
  )
  return manifest.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

type ImportReport =
  | {
      readonly status: 'error'
      readonly mode: 'dry-run' | 'apply'
      readonly counts: { readonly error: number }
      readonly errors: readonly LocalSponsorImportError[]
      readonly bundleFiles: readonly BundleFile[]
    }
  | {
      readonly status: 'ok'
      readonly mode: 'dry-run' | 'apply'
      readonly inputCount: number
      readonly publishableCount: number
      readonly counts: {
        readonly create: number
        readonly update: number
        readonly unchanged: number
        readonly error: 0
      }
      readonly imageDiff: {
        readonly upload: number
        readonly reuse: number
        readonly none: number
      }
      readonly importIds: readonly string[]
      readonly missingImportIds: readonly string[]
      readonly checks: {
        readonly pins: readonly string[]
        readonly images: readonly string[]
        readonly links: readonly string[]
      }
      readonly bundleFiles: readonly BundleFile[]
    }

export async function runLocalSponsorImport<TransactionId>({
  json,
  imageRoot,
  existingSponsors,
  store,
  apply,
  expectedCount,
  bundleFiles,
}: {
  readonly json: string
  readonly imageRoot: string
  readonly existingSponsors: readonly Sponsor[]
  readonly store: LocalSponsorImportStore<TransactionId>
  readonly apply: boolean
  readonly expectedCount: number | null
  readonly bundleFiles: readonly BundleFile[]
}): Promise<ImportReport> {
  const mode = apply ? 'apply' : 'dry-run'
  const existingImportIds = existingSponsors
    .map(({ local_import_id }) => local_import_id)
    .filter((value): value is string => Boolean(value))
  const validation = await validateLocalSponsorImportBundle(json, {
    imageRoot,
    existingImportIds,
  })
  if (!validation.ok) {
    return {
      status: 'error',
      mode,
      counts: { error: validation.errors.length },
      errors: validation.errors,
      bundleFiles,
    }
  }
  if (expectedCount !== null && validation.rows.length !== expectedCount) {
    const errors: LocalSponsorImportError[] = [
      {
        index: -1,
        importId: null,
        field: '$count',
        reason: `入力件数${validation.rows.length}件がexpected count ${expectedCount}件と一致しません`,
      },
    ]
    return {
      status: 'error',
      mode,
      counts: { error: errors.length },
      errors,
      bundleFiles,
    }
  }

  const plan = createLocalSponsorImportPlan(validation.rows, existingSponsors)
  if (apply) await applyLocalSponsorImportPlan(plan, store)
  const importIds = validation.rows.map(({ importId }) => importId)
  return {
    status: 'ok',
    mode,
    inputCount: validation.rows.length,
    publishableCount: validation.rows.length,
    counts: { ...plan.counts, error: 0 },
    imageDiff: {
      upload: new Set(
        plan.actions.flatMap(({ image }) => (image.kind === 'upload' ? [image.checksum] : [])),
      ).size,
      reuse: plan.actions.filter(({ image }) => image.kind === 'reuse').length,
      none: plan.actions.filter(({ image }) => image.kind === 'none').length,
    },
    importIds,
    missingImportIds: plan.missingImportIds,
    checks: {
      pins: importIds,
      images: validation.rows.filter(({ image }) => image !== null).map(({ importId }) => importId),
      links: validation.rows
        .filter(({ websiteUrl }) => websiteUrl !== null)
        .map(({ importId }) => importId),
    },
    bundleFiles,
  }
}

export class PayloadLocalSponsorImportStore implements LocalSponsorImportStore<string | number> {
  constructor(private readonly payload: Payload) {}

  private request(transactionID: string | number): PayloadRequest {
    return { transactionID } as PayloadRequest
  }

  async beginTransaction(): Promise<string | number> {
    return (await this.payload.db.beginTransaction()) as string | number
  }

  async commitTransaction(transactionID: string | number): Promise<void> {
    await this.payload.db.commitTransaction(transactionID)
  }

  async rollbackTransaction(transactionID: string | number): Promise<void> {
    await this.payload.db.rollbackTransaction(transactionID)
  }

  async createMedia(
    row: ValidatedLocalSponsorImportRow,
    transactionID: string | number,
  ): Promise<number> {
    if (!row.image) throw new Error('画像なしの行をuploadできません')
    const media = await this.payload.create({
      collection: 'media',
      data: { alt: row.imageDecorative ? '' : row.imageAlt },
      filePath: row.image.absolutePath,
      overrideAccess: true,
      req: this.request(transactionID),
    })
    return media.id
  }

  async deleteMedia(id: number, transactionID: string | number): Promise<void> {
    await this.payload.delete({
      collection: 'media',
      id,
      overrideAccess: true,
      req: this.request(transactionID),
    })
  }

  async createSponsor(
    data: Record<string, unknown>,
    transactionID: string | number,
  ): Promise<number> {
    const sponsor = await this.payload.create({
      collection: 'sponsors',
      data: data as never,
      overrideAccess: true,
      req: this.request(transactionID),
    })
    return sponsor.id
  }

  async updateSponsor(
    id: number,
    data: Record<string, unknown>,
    transactionID: string | number,
  ): Promise<void> {
    await this.payload.update({
      collection: 'sponsors',
      id,
      data: data as never,
      overrideAccess: true,
      req: this.request(transactionID),
    })
  }
}

async function main(): Promise<void> {
  const options = parseLocalSponsorImportArgs(process.argv.slice(2))
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const payload = await getPayload({ config })
  try {
    const existing = await payload.find({
      collection: 'sponsors',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
    })
    const [json, bundleFiles] = await Promise.all([
      readFile(options.inputPath, 'utf8'),
      createBundleManifest(options.inputPath, options.imageRoot),
    ])
    const report = await runLocalSponsorImport({
      json,
      imageRoot: options.imageRoot,
      existingSponsors: existing.docs,
      store: new PayloadLocalSponsorImportStore(payload),
      apply: options.apply,
      expectedCount: options.expectedCount,
      bundleFiles,
    })
    console.log(JSON.stringify(report, null, 2))
    if (report.status === 'error') process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      )
      process.exit(1)
    })
}
