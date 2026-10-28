import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLocalReq, getFileByPath, type Payload, type PayloadRequest } from 'payload'
import { getSafeFileName } from 'payload/internal'

import type { Media, Sponsor } from '../src/payload-types'
import {
  applyLocalSponsorImportPlan,
  type CreatedLocalSponsorMedia,
  createLocalSponsorImportPlan,
  type LocalSponsorImportError,
  type LocalSponsorMediaCleanupToken,
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

export function ensureRemoteStorageForApply(
  apply: boolean,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (apply && !environment.S3_BUCKET?.trim()) {
    throw new Error('--apply には S3_BUCKET の設定が必要です（ローカル保存にはfallbackしません）')
  }
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
  private readonly deleteStorageBlobs: (token: LocalSponsorMediaCleanupToken) => Promise<void>
  private readonly uploadStorageBlobs: (
    media: Media,
    request: PayloadRequest,
    token: LocalSponsorMediaCleanupToken,
  ) => Promise<void>

  constructor(
    private readonly payload: Payload,
    deleteStorageBlobs?: (token: LocalSponsorMediaCleanupToken) => Promise<void>,
    uploadStorageBlobs?: (
      media: Media,
      request: PayloadRequest,
      token: LocalSponsorMediaCleanupToken,
    ) => Promise<void>,
  ) {
    this.deleteStorageBlobs =
      deleteStorageBlobs ??
      (async (token) => {
        await deletePayloadStorageBlobs(this.payload, token)
      })
    this.uploadStorageBlobs =
      uploadStorageBlobs ??
      ((media, request, token) => uploadPayloadStorageBlobs(this.payload, media, request, token))
  }

  private request(transactionID: string | number): PayloadRequest {
    return { payload: this.payload, transactionID } as PayloadRequest
  }

  private sponsorRequest(transactionID: string | number): PayloadRequest {
    const request = this.request(transactionID)
    request.context = { localSponsorExplicitCoordinates: true }
    return request
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
    registerCleanupToken: (token: LocalSponsorMediaCleanupToken) => void,
  ): Promise<CreatedLocalSponsorMedia> {
    if (!row.image) throw new Error('画像なしの行をuploadできません')
    const request = this.request(transactionID)
    request.context = { skipCloudStorage: true }
    const planned = await preparePayloadMediaUpload(this.payload, row, request)
    registerCleanupToken(planned.cleanupToken)
    const media = await this.payload.create({
      collection: 'media',
      data: { alt: row.imageDecorative ? '' : row.imageAlt, prefix: planned.cleanupToken.prefix },
      file: planned.file,
      overrideAccess: true,
      overwriteExistingFiles: true,
      req: request,
    })
    planned.cleanupToken.mediaId = media.id
    await this.uploadStorageBlobs(media, request, planned.cleanupToken)
    return { id: media.id, cleanupToken: planned.cleanupToken }
  }

  async deleteMediaBlobs(token: LocalSponsorMediaCleanupToken): Promise<void> {
    await this.deleteStorageBlobs(token)
  }

  async createSponsor(
    data: Record<string, unknown>,
    transactionID: string | number,
  ): Promise<number> {
    const sponsor = await this.payload.create({
      collection: 'sponsors',
      data: data as never,
      overrideAccess: true,
      req: this.sponsorRequest(transactionID),
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
      req: this.sponsorRequest(transactionID),
    })
  }
}

type PayloadUploadFile = NonNullable<Awaited<ReturnType<typeof getFileByPath>>>

interface PlannedPayloadMediaUpload {
  readonly file: PayloadUploadFile
  readonly cleanupToken: LocalSponsorMediaCleanupToken
}

function configuredMediaPrefix(payload: Payload): string | null {
  const mediaCollection = payload.collections.media?.config
  const prefixField = mediaCollection?.fields.find(
    (field) => 'name' in field && field.name === 'prefix',
  )
  const value = prefixField && 'defaultValue' in prefixField ? prefixField.defaultValue : undefined
  return typeof value === 'string' ? value.replace(/^\/+|\/+$/g, '') || null : null
}

export async function preparePayloadMediaUpload(
  payload: Payload,
  row: ValidatedLocalSponsorImportRow,
  req: PayloadRequest,
): Promise<PlannedPayloadMediaUpload> {
  if (!row.image) throw new Error('image is required for media upload')
  const mediaCollection = payload.collections.media?.config
  const upload = mediaCollection?.upload
  const sharp = payload.config.sharp
  if (!mediaCollection || !upload || typeof upload !== 'object' || !sharp) {
    throw new Error('Media upload configuration is unavailable')
  }
  if (upload.formatOptions?.format !== 'webp') {
    throw new Error('Media original format must be WebP')
  }
  const configuredSizes = upload.imageSizes ?? []
  if (
    configuredSizes.some(
      (size) =>
        typeof size.width !== 'number' ||
        size.height !== undefined ||
        size.generateImageName !== undefined ||
        size.trimOptions !== undefined ||
        size.formatOptions?.format !== 'webp',
    )
  ) {
    throw new Error('Media image-size filename plan is unsupported')
  }

  const sourceFile = await getFileByPath(row.image.absolutePath)
  if (!sourceFile) throw new Error('Media source file could not be read')
  const prefix = configuredMediaPrefix(payload)
  const desiredFilename = `local-sponsor-${row.image.checksum}.webp`
  const safeFilename = await getSafeFileName({
    collectionSlug: 'media',
    desiredFilename,
    prefix: prefix ?? undefined,
    req,
    staticPath: upload.staticDir,
  })
  const baseFilename = safeFilename.slice(0, safeFilename.lastIndexOf('.'))
  const constructorOptions = sourceFile.mimetype === 'image/webp' ? { animated: true } : undefined
  const originalMetadata = await sharp(sourceFile.data, constructorOptions).rotate().metadata()
  const sizeFilenames = await Promise.all(
    configuredSizes.map(async (size) => {
      let resized = sharp(sourceFile.data, constructorOptions).rotate().resize(size)
      resized = resized.toFormat(size.formatOptions!.format, size.formatOptions!.options)
      const { info } = await resized.toBuffer({ resolveWithObject: true })
      const height = originalMetadata.pages ? info.height / originalMetadata.pages : info.height
      return `${baseFilename}-${info.width}x${height}.webp`
    }),
  )
  const filenames = [...new Set([safeFilename, ...sizeFilenames])]
  const cleanupToken: LocalSponsorMediaCleanupToken = {
    mediaId: null,
    prefix,
    filenames,
    blobIdentifiers: filenames.map((filename) => (prefix ? `${prefix}/${filename}` : filename)),
  }
  return {
    file: { ...sourceFile, name: safeFilename },
    cleanupToken,
  }
}

type PreservedCloudUpload = {
  readonly file?: PayloadUploadFile
  readonly uploadSizes?: Readonly<Record<string, Buffer>>
}

export async function uploadPayloadStorageBlobs(
  payload: Payload,
  media: Media,
  sourceRequest: PayloadRequest,
  token: LocalSponsorMediaCleanupToken,
): Promise<void> {
  const mediaCollection = payload.config.collections.find(({ slug }) => slug === 'media')
  const storageUploadHook = mediaCollection?.hooks?.afterChange?.at(-1)
  if (
    !mediaCollection?.upload ||
    mediaCollection.upload.adapter !== 's3' ||
    typeof storageUploadHook !== 'function'
  ) {
    throw new Error('MediaのS3 upload adapterを取得できません')
  }

  const preserved = sourceRequest.context?._payloadCloudStorage as PreservedCloudUpload | undefined
  const originalFile = preserved?.file ?? sourceRequest.file
  const uploadSizes = preserved?.uploadSizes ?? sourceRequest.payloadUploadSizes
  const files = new Map<
    string,
    { readonly buffer: Buffer; readonly mimeType: string; readonly source: PayloadUploadFile }
  >()
  if (media.filename && media.mimeType && originalFile?.data) {
    files.set(media.filename, {
      buffer: originalFile.data,
      mimeType: media.mimeType,
      source: originalFile,
    })
  }
  for (const [sizeName, size] of Object.entries(media.sizes ?? {})) {
    const buffer = uploadSizes?.[sizeName]
    if (size?.filename && size.mimeType && buffer) {
      files.set(size.filename, { buffer, mimeType: size.mimeType, source: originalFile! })
    }
  }

  const updateFreePayload = new Proxy(payload, {
    get(target, property, receiver) {
      if (property === 'update') return async () => media
      return Reflect.get(target, property, receiver)
    },
  })
  const attempts = token.filenames.map(async (filename) => {
    const file = files.get(filename)
    if (!file) throw new Error(`Payloadが生成したupload bufferがありません: ${filename}`)
    const req = await createLocalReq(
      { req: { transactionID: sourceRequest.transactionID } as PayloadRequest },
      payload,
    )
    req.payload = updateFreePayload
    req.file = {
      ...file.source,
      data: file.buffer,
      mimetype: file.mimeType,
      name: filename,
      size: file.buffer.length,
    }
    req.payloadUploadSizes = {}
    await storageUploadHook({
      collection: mediaCollection,
      context: req.context,
      data: media,
      doc: { ...media, filename, mimeType: file.mimeType, sizes: {} },
      operation: 'create',
      previousDoc: {},
      req,
    } as never)
  })
  const results = await Promise.allSettled(attempts)
  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [{ blobIdentifier: token.blobIdentifiers[index], reason: result.reason }]
      : [],
  )
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map(({ reason }) => reason),
      `S3 blob upload失敗: ${failures.map(({ blobIdentifier }) => blobIdentifier).join(', ')}`,
    )
  }
}

export async function deletePayloadStorageBlobs(
  payload: Payload,
  token: LocalSponsorMediaCleanupToken,
): Promise<PayloadRequest> {
  const mediaCollection = payload.config.collections.find(({ slug }) => slug === 'media')
  const storageDeleteHook = mediaCollection?.hooks?.afterDelete?.at(-1)
  if (
    !mediaCollection?.upload ||
    mediaCollection.upload.adapter !== 's3' ||
    typeof storageDeleteHook !== 'function'
  ) {
    throw new Error('MediaのS3削除adapterを取得できません')
  }

  const hookErrors: unknown[] = []
  const logger = new Proxy(payload.logger, {
    get(target, property, receiver) {
      if (property === 'error') {
        return (...args: unknown[]) => {
          const logged = args.find(
            (arg): arg is { err: unknown } =>
              typeof arg === 'object' && arg !== null && 'err' in arg,
          )
          hookErrors.push(logged?.err ?? args)
        }
      }
      const value = Reflect.get(target, property, receiver) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const cleanupPayload = new Proxy(payload, {
    get(target, property, receiver) {
      return property === 'logger' ? logger : Reflect.get(target, property, receiver)
    },
  })
  const req = await createLocalReq({}, payload)
  req.payload = cleanupPayload
  const [filename, ...sizes] = token.filenames
  await storageDeleteHook({
    collection: mediaCollection,
    context: req.context,
    doc: {
      id: token.mediaId,
      filename,
      prefix: token.prefix,
      sizes: Object.fromEntries(
        sizes.map((sizeFilename, index) => [index, { filename: sizeFilename }]),
      ),
    },
    req,
  } as never)
  if (hookErrors.length > 0) {
    throw new AggregateError(hookErrors, `S3 blob削除失敗: ${token.blobIdentifiers.join(', ')}`)
  }
  return req
}

async function loadConfiguredPayload(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  return getPayload({ config })
}

export async function main({
  args = process.argv.slice(2),
  environment = process.env,
  loadPayload = loadConfiguredPayload,
}: {
  readonly args?: readonly string[]
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly loadPayload?: () => Promise<Payload>
} = {}): Promise<void> {
  const options = parseLocalSponsorImportArgs(args)
  ensureRemoteStorageForApply(options.apply, environment)
  const payload = await loadPayload()
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
