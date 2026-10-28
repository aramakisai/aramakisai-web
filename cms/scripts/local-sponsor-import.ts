import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

import { generateNKeysBetween } from 'payload/shared'

import type { Sponsor } from '../src/payload-types'
import { LOCAL_SPONSOR_CATEGORY_OPTIONS } from '../src/collections/sponsors'

export type CanonicalLocalSponsorCategory = NonNullable<Sponsor['local_map_category']>

export interface LocalSponsorImportError {
  readonly index: number
  readonly importId: string | null
  readonly field: string
  readonly reason: string
}

export interface ValidatedLocalSponsorImportRow {
  readonly importId: string
  readonly name: string
  readonly category: CanonicalLocalSponsorCategory
  readonly latitude: number
  readonly longitude: number
  readonly address: string | null
  readonly image: {
    readonly relativePath: string
    readonly absolutePath: string
    readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    readonly checksum: string
  } | null
  readonly imageAlt: string | null
  readonly imageDecorative: boolean
  readonly message: string | null
  readonly businessHours: string | null
  readonly closedDays: string | null
  readonly phone: string | null
  readonly websiteUrl: string | null
  readonly order: number | null
}

export type LocalSponsorImportValidationResult =
  | {
      readonly ok: true
      readonly rows: readonly ValidatedLocalSponsorImportRow[]
    }
  | { readonly ok: false; readonly errors: readonly LocalSponsorImportError[] }

type RowObject = Record<string, unknown>
type ErrorInput = Omit<LocalSponsorImportError, 'index' | 'importId'>

const TEXT_MAX_LENGTHS = {
  importId: 255,
  name: 255,
  websiteUrl: 500,
  address: 500,
  imageAlt: 500,
  phone: 100,
} as const

function validateMaxLength(
  field: string,
  value: string,
  maxLength: number | undefined,
  errors: ErrorInput[],
): void {
  if (maxLength !== undefined && value.length > maxLength) {
    errors.push({ field, reason: `${maxLength}文字以下が必要です` })
  }
}

function optionalString(
  row: RowObject,
  field: string,
  errors: ErrorInput[],
  maxLength?: number,
): string | null {
  const value = row[field]
  if (value === null) return null
  if (typeof value !== 'string') {
    errors.push({ field, reason: '文字列またはnullが必要です' })
    return null
  }
  const trimmed = value.trim()
  validateMaxLength(field, trimmed, maxLength, errors)
  return trimmed === '' ? null : trimmed
}

function requiredString(
  row: RowObject,
  field: string,
  errors: ErrorInput[],
  maxLength?: number,
): string {
  const value = row[field]
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, reason: '空白でない文字列が必要です' })
    return ''
  }
  const trimmed = value.trim()
  validateMaxLength(field, trimmed, maxLength, errors)
  return trimmed
}

function coordinate(
  row: RowObject,
  field: 'latitude' | 'longitude',
  min: number,
  max: number,
  errors: ErrorInput[],
): number {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push({ field, reason: `${min}以上${max}以下の有限数が必要です` })
    return 0
  }
  return value
}

function canonicalCategory(value: unknown, errors: ErrorInput[]): CanonicalLocalSponsorCategory {
  if (
    typeof value !== 'string' ||
    !LOCAL_SPONSOR_CATEGORY_OPTIONS.some(({ value: allowed }) => value === allowed)
  ) {
    errors.push({ field: 'category', reason: '定義済みカテゴリが必要です' })
    return 'hospital'
  }
  return value as CanonicalLocalSponsorCategory
}

type AllowedImageMime = NonNullable<ValidatedLocalSponsorImportRow['image']>['mimeType']

function imageMime(buffer: Buffer): AllowedImageMime | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function isOutside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
}

async function validateImage(
  imageRoot: string,
  relativePath: string,
  errors: ErrorInput[],
): Promise<ValidatedLocalSponsorImportRow['image']> {
  const root = path.resolve(imageRoot)
  const candidate = path.resolve(root, relativePath)
  if (isOutside(root, candidate)) {
    errors.push({ field: 'imageFile', reason: '画像参照がimage root外です' })
    return null
  }

  try {
    const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)])
    if (isOutside(realRoot, realCandidate)) {
      errors.push({ field: 'imageFile', reason: '画像参照がimage root外です' })
      return null
    }
    if (!(await stat(realCandidate)).isFile()) {
      errors.push({ field: 'imageFile', reason: '画像参照がファイルではありません' })
      return null
    }
    const buffer = await readFile(realCandidate)
    const mimeType = imageMime(buffer)
    if (mimeType === null) {
      errors.push({ field: 'imageFile', reason: '許可された画像MIMEではありません' })
      return null
    }
    return {
      relativePath: path.relative(realRoot, realCandidate).split(path.sep).join('/'),
      absolutePath: realCandidate,
      mimeType,
      checksum: createHash('sha256').update(buffer).digest('hex'),
    }
  } catch {
    errors.push({ field: 'imageFile', reason: '画像が存在しません' })
    return null
  }
}

export async function validateLocalSponsorImportBundle(
  json: string,
  {
    imageRoot,
    existingImportIds,
  }: {
    readonly imageRoot: string
    readonly existingImportIds: readonly string[]
  },
): Promise<LocalSponsorImportValidationResult> {
  let input: unknown
  try {
    input = JSON.parse(json)
  } catch {
    return {
      ok: false,
      errors: [{ index: -1, importId: null, field: '$', reason: 'JSONを解析できません' }],
    }
  }
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ index: -1, importId: null, field: '$', reason: 'JSON配列が必要です' }],
    }
  }

  const inputIds = input.map((value) =>
    value !== null && typeof value === 'object' && typeof (value as RowObject).importId === 'string'
      ? ((value as RowObject).importId as string).trim()
      : null,
  )
  const inputCounts = new Map<string, number>()
  for (const id of inputIds) if (id) inputCounts.set(id, (inputCounts.get(id) ?? 0) + 1)
  const cmsCounts = new Map<string, number>()
  for (const id of existingImportIds) cmsCounts.set(id, (cmsCounts.get(id) ?? 0) + 1)

  const errors: LocalSponsorImportError[] = []
  const rows: ValidatedLocalSponsorImportRow[] = []

  for (const [index, value] of input.entries()) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push({ index, importId: null, field: '$', reason: 'オブジェクトが必要です' })
      continue
    }
    const row = value as RowObject
    const rowErrors: ErrorInput[] = []
    const importId = requiredString(row, 'importId', rowErrors, TEXT_MAX_LENGTHS.importId)
    const name = requiredString(row, 'name', rowErrors, TEXT_MAX_LENGTHS.name)
    if (importId && (inputCounts.get(importId) ?? 0) > 1) {
      rowErrors.push({ field: 'importId', reason: '入力内で重複しています' })
    }
    if (importId && (cmsCounts.get(importId) ?? 0) > 1) {
      rowErrors.push({ field: 'importId', reason: 'CMS内で重複しています' })
    }

    const rawCategory = row.category
    const category = canonicalCategory(rawCategory, rowErrors)
    const latitude = coordinate(row, 'latitude', -90, 90, rowErrors)
    const longitude = coordinate(row, 'longitude', -180, 180, rowErrors)
    const address = optionalString(row, 'address', rowErrors, TEXT_MAX_LENGTHS.address)
    const imageFile = optionalString(row, 'imageFile', rowErrors)
    const imageAlt = optionalString(row, 'imageAlt', rowErrors, TEXT_MAX_LENGTHS.imageAlt)
    const message = optionalString(row, 'message', rowErrors)
    const businessHours = optionalString(row, 'businessHours', rowErrors)
    const closedDays = optionalString(row, 'closedDays', rowErrors)
    const phone = optionalString(row, 'phone', rowErrors, TEXT_MAX_LENGTHS.phone)
    const website = optionalString(row, 'websiteUrl', rowErrors, TEXT_MAX_LENGTHS.websiteUrl)

    const imageDecorative = row.imageDecorative
    if (typeof imageDecorative !== 'boolean') {
      rowErrors.push({ field: 'imageDecorative', reason: 'booleanが必要です' })
    }
    const order = row.order
    if (order !== null && (typeof order !== 'number' || !Number.isSafeInteger(order))) {
      rowErrors.push({ field: 'order', reason: '整数またはnullが必要です' })
    }
    if (website !== null) {
      try {
        const parsed = new URL(website)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
      } catch {
        rowErrors.push({ field: 'websiteUrl', reason: 'httpまたはhttpsの絶対URLが必要です' })
      }
    }
    if (imageFile !== null && (imageAlt !== null) === (imageDecorative === true)) {
      rowErrors.push({
        field: 'imageAlt',
        reason: '画像にはaltまたは装飾指定のどちらか一方が必要です',
      })
    }
    const image = imageFile === null ? null : await validateImage(imageRoot, imageFile, rowErrors)

    errors.push(
      ...rowErrors.map((error) => ({
        index,
        importId: importId || null,
        ...error,
      })),
    )
    if (rowErrors.length === 0) {
      rows.push({
        importId,
        name,
        category,
        latitude,
        longitude,
        address,
        image,
        imageAlt,
        imageDecorative: imageDecorative as boolean,
        message,
        businessHours,
        closedDays,
        phone,
        websiteUrl: website,
        order: order as number | null,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, rows }
}

export type LocalSponsorImagePlan =
  | { readonly kind: 'none'; readonly mediaId: null }
  | { readonly kind: 'reuse'; readonly mediaId: number }
  | { readonly kind: 'upload'; readonly checksum: string }

export type LocalSponsorImportAction = {
  readonly kind: 'create' | 'update' | 'unchanged'
  readonly sponsorId: number | null
  readonly row: ValidatedLocalSponsorImportRow
  readonly data: Readonly<Record<string, unknown>>
  readonly image: LocalSponsorImagePlan
}

export interface LocalSponsorImportPlan {
  readonly actions: readonly LocalSponsorImportAction[]
  readonly counts: {
    readonly create: number
    readonly update: number
    readonly unchanged: number
  }
  readonly missingImportIds: readonly string[]
}

export interface LocalSponsorMediaCleanupToken {
  mediaId: number | null
  readonly prefix: string | null
  readonly filenames: readonly string[]
  readonly blobIdentifiers: readonly string[]
}

export interface CreatedLocalSponsorMedia {
  readonly id: number
  readonly cleanupToken: LocalSponsorMediaCleanupToken
}

export interface LocalSponsorImportStore<TransactionId> {
  beginTransaction(): Promise<TransactionId>
  commitTransaction(transactionId: TransactionId): Promise<void>
  rollbackTransaction(transactionId: TransactionId): Promise<void>
  createMedia(
    row: ValidatedLocalSponsorImportRow,
    transactionId: TransactionId,
    registerCleanupToken: (token: LocalSponsorMediaCleanupToken) => void,
  ): Promise<CreatedLocalSponsorMedia>
  deleteMediaBlobs(token: LocalSponsorMediaCleanupToken): Promise<void>
  createSponsor(data: Record<string, unknown>, transactionId: TransactionId): Promise<number>
  updateSponsor(
    id: number,
    data: Record<string, unknown>,
    transactionId: TransactionId,
  ): Promise<void>
}

function relationId(value: Sponsor['local_image']): number | null {
  if (value == null) return null
  return typeof value === 'object' ? value.id : value
}

function orderKeys(
  rows: readonly ValidatedLocalSponsorImportRow[],
  existingSponsors: readonly Sponsor[],
  existingImportIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const orderedRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !existingImportIds.has(row.importId))
    .sort((a, b) => {
      if (a.row.order === null) return b.row.order === null ? a.index - b.index : 1
      if (b.row.order === null) return -1
      return a.row.order - b.row.order || a.index - b.index
    })
  const lastOrder = existingSponsors.reduce<string | null>((latest, sponsor) => {
    const order = sponsor._order
    return typeof order === 'string' && (latest === null || order > latest) ? order : latest
  }, null)
  const keys = generateNKeysBetween(lastOrder, null, orderedRows.length)
  return new Map(orderedRows.map(({ row }, index) => [row.importId, keys[index]]))
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return (a ?? null) === (b ?? null)
}

function sponsorData(
  row: ValidatedLocalSponsorImportRow,
  existing: Sponsor | undefined,
  orderKey: string | undefined,
): Record<string, unknown> {
  const type = existing ? [...new Set([...existing.type, 'local' as const])] : ['local']
  return {
    type,
    name: row.name,
    url: row.websiteUrl,
    description: row.message,
    address: row.address,
    local_import_id: row.importId,
    local_map_category: row.category,
    local_latitude: row.latitude,
    local_longitude: row.longitude,
    local_image_alt: row.imageAlt,
    local_image_decorative: row.imageDecorative,
    local_business_hours: row.businessHours,
    local_closed_days: row.closedDays,
    local_phone: row.phone,
    local_image_checksum: row.image?.checksum ?? null,
    ...(orderKey === undefined ? {} : { _order: orderKey }),
  }
}

export function createLocalSponsorImportPlan(
  rows: readonly ValidatedLocalSponsorImportRow[],
  existingSponsors: readonly Sponsor[],
): LocalSponsorImportPlan {
  const byImportId = new Map(
    existingSponsors
      .filter((sponsor) => sponsor.local_import_id)
      .map((sponsor) => [sponsor.local_import_id!, sponsor]),
  )
  const orderKeyByImportId = orderKeys(rows, existingSponsors, new Set(byImportId.keys()))
  const mediaByChecksum = new Map<string, number>()
  for (const sponsor of existingSponsors) {
    const mediaId = relationId(sponsor.local_image)
    if (sponsor.local_image_checksum && mediaId !== null) {
      mediaByChecksum.set(sponsor.local_image_checksum, mediaId)
    }
  }

  const actions = rows.map((row): LocalSponsorImportAction => {
    const existing = byImportId.get(row.importId)
    const data = sponsorData(row, existing, orderKeyByImportId.get(row.importId))
    const reusableMediaId = row.image ? mediaByChecksum.get(row.image.checksum) : undefined
    const image: LocalSponsorImagePlan = row.image
      ? reusableMediaId === undefined
        ? { kind: 'upload', checksum: row.image.checksum }
        : { kind: 'reuse', mediaId: reusableMediaId }
      : { kind: 'none', mediaId: null }

    if (!existing) {
      return { kind: 'create', sponsorId: null, row, data, image }
    }
    const imageMatches =
      image.kind === 'upload' ? false : relationId(existing.local_image) === image.mediaId
    const dataMatches = Object.entries(data).every(([field, value]) =>
      valuesEqual(existing[field as keyof Sponsor], value),
    )
    return {
      kind: imageMatches && dataMatches ? 'unchanged' : 'update',
      sponsorId: existing.id,
      row,
      data,
      image,
    }
  })

  const inputIds = new Set(rows.map(({ importId }) => importId))
  const missingImportIds = existingSponsors
    .filter(
      (sponsor) =>
        sponsor.type.includes('local') &&
        sponsor.local_import_id &&
        !inputIds.has(sponsor.local_import_id),
    )
    .map((sponsor) => sponsor.local_import_id!)
    .sort()
  return {
    actions,
    counts: {
      create: actions.filter(({ kind }) => kind === 'create').length,
      update: actions.filter(({ kind }) => kind === 'update').length,
      unchanged: actions.filter(({ kind }) => kind === 'unchanged').length,
    },
    missingImportIds,
  }
}

export async function applyLocalSponsorImportPlan<TransactionId>(
  plan: LocalSponsorImportPlan,
  store: LocalSponsorImportStore<TransactionId>,
): Promise<void> {
  const transactionId = await store.beginTransaction()
  const createdMedia: LocalSponsorMediaCleanupToken[] = []
  const uploadedByChecksum = new Map<string, CreatedLocalSponsorMedia>()
  try {
    for (const action of plan.actions) {
      if (action.kind === 'unchanged') continue
      let mediaId: number | null
      if (action.image.kind === 'upload') {
        const cached = uploadedByChecksum.get(action.image.checksum)
        if (cached !== undefined) {
          mediaId = cached.id
        } else {
          const uploaded = await store.createMedia(action.row, transactionId, (cleanupToken) => {
            createdMedia.push(cleanupToken)
          })
          mediaId = uploaded.id
          uploadedByChecksum.set(action.image.checksum, uploaded)
        }
      } else {
        mediaId = action.image.mediaId
      }
      const data = { ...action.data, local_image: mediaId }
      if (action.kind === 'create') {
        await store.createSponsor(data, transactionId)
      } else {
        await store.updateSponsor(action.sponsorId!, data, transactionId)
      }
    }
    await store.commitTransaction(transactionId)
  } catch (error) {
    try {
      await store.rollbackTransaction(transactionId)
    } catch (rollbackError) {
      const pendingBlobs = createdMedia.flatMap(({ blobIdentifiers }) => blobIdentifiers)
      throw new AggregateError(
        [error, rollbackError],
        `${error instanceof Error ? error.message : '取り込み失敗'}（rollback失敗、未削除blob: ${pendingBlobs.join(', ') || 'なし'}）`,
      )
    }
    const cleanupErrors: unknown[] = []
    const failedBlobIdentifiers: string[] = []
    for (const token of [...createdMedia].reverse()) {
      try {
        await store.deleteMediaBlobs(token)
      } catch (cleanupError) {
        failedBlobIdentifiers.push(...token.blobIdentifiers)
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        `${error instanceof Error ? error.message : '取り込み失敗'}（Media補償削除失敗 blob: ${failedBlobIdentifiers.join(', ')}）`,
      )
    }
    throw error
  }
}
