import type { CollectionBeforeValidateHook } from 'payload'
import { ValidationError } from 'payload'

import { blankToNull, type ConstraintViolation } from './constraints'

export const LOCAL_SPONSOR_CATEGORIES = [
  'hospital',
  'life',
  'car',
  'education',
  'food',
  'shop',
] as const

type LocalSponsorDoc = Record<string, unknown> & {
  readonly type?: unknown
  readonly url?: unknown
  readonly local_map_category?: unknown
  readonly local_latitude?: unknown
  readonly local_longitude?: unknown
  readonly local_image?: unknown
  readonly local_image_alt?: unknown
  readonly local_image_decorative?: unknown
}

const LOCAL_TEXT_FIELDS = [
  'local_import_id',
  'url',
  'address',
  'description',
  'local_image_alt',
  'local_business_hours',
  'local_closed_days',
  'local_phone',
  'local_image_checksum',
] as const

function isLocal(doc: LocalSponsorDoc): boolean {
  return Array.isArray(doc.type) && doc.type.includes('local')
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function invalidCoordinate(value: unknown, min: number, max: number): boolean {
  return (
    hasValue(value) &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
  )
}

function normalizeLocalTextFields<T extends LocalSponsorDoc>(doc: T): T {
  const normalized: Record<string, unknown> = { ...doc }
  for (const field of LOCAL_TEXT_FIELDS) {
    if (field in doc) normalized[field] = blankToNull(doc[field])
  }
  return normalized as T
}

export function normalizeLocalSponsorMap<T extends LocalSponsorDoc>(doc: T): T {
  return isLocal(doc) ? normalizeLocalTextFields(doc) : doc
}

export function validateLocalSponsorMap(doc: LocalSponsorDoc): readonly ConstraintViolation[] {
  if (!isLocal(doc)) return []

  const violations: ConstraintViolation[] = []
  if (
    hasValue(doc.local_map_category) &&
    !LOCAL_SPONSOR_CATEGORIES.includes(
      doc.local_map_category as (typeof LOCAL_SPONSOR_CATEGORIES)[number],
    )
  ) {
    violations.push({
      field: 'local_map_category',
      message: '地図カテゴリは定義済みの6カテゴリから選んでください',
    })
  }
  if (invalidCoordinate(doc.local_latitude, -90, 90)) {
    violations.push({
      field: 'local_latitude',
      message: '緯度は-90以上90以下の有限数にしてください',
    })
  }
  if (invalidCoordinate(doc.local_longitude, -180, 180)) {
    violations.push({
      field: 'local_longitude',
      message: '経度は-180以上180以下の有限数にしてください',
    })
  }
  if (hasValue(doc.url)) {
    try {
      const parsed = new URL(String(doc.url))
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
    } catch {
      violations.push({
        field: 'url',
        message: 'Webサイト URL は http または https の絶対URLにしてください',
      })
    }
  }

  if (hasValue(doc.local_image)) {
    const hasAlt = typeof doc.local_image_alt === 'string' && doc.local_image_alt.trim() !== ''
    const decorative = doc.local_image_decorative === true
    if (hasAlt === decorative) {
      violations.push({
        field: 'local_image_alt',
        message: '掲載画像には代替テキストまたは装飾画像の指定が必要です',
      })
    }
  }
  return violations
}

export const localSponsorMapConstraint: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const partial = (data ?? {}) as LocalSponsorDoc
  const effective = { ...(originalDoc ?? {}), ...partial }
  const normalized = isLocal(effective) ? normalizeLocalTextFields(partial) : partial
  const violations = validateLocalSponsorMap({
    ...(originalDoc ?? {}),
    ...normalized,
  })
  if (violations.length > 0) {
    throw new ValidationError({
      collection: 'sponsors',
      errors: violations.map(({ field, message }) => ({ path: field, message })),
    })
  }
  return normalized
}
