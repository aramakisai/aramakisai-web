import type { CollectionBeforeValidateHook } from 'payload'
import { ValidationError } from 'payload'

import { blankToNull, type ConstraintViolation } from './constraints'

type LocalSponsorDoc = Record<string, unknown> & {
  readonly type?: unknown
  readonly url?: unknown
  readonly local_map_category?: unknown
  readonly local_latitude?: unknown
  readonly local_longitude?: unknown
  readonly local_image?: unknown
  readonly local_image_alt?: unknown
  readonly local_image_decorative?: unknown
  readonly address?: unknown
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

function validCoordinatePair(doc: LocalSponsorDoc): boolean {
  return (
    typeof doc.local_latitude === 'number' &&
    Number.isFinite(doc.local_latitude) &&
    typeof doc.local_longitude === 'number' &&
    Number.isFinite(doc.local_longitude)
  )
}

export async function geocodeLocalSponsorAddress(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ latitude: number; longitude: number }> {
  const response = await fetchImpl(
    `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`,
    { signal: AbortSignal.timeout(5_000) },
  )
  if (!response.ok) throw new Error(`国土地理院住所検索API: HTTP ${response.status}`)
  const data = (await response.json()) as unknown
  if (!Array.isArray(data)) throw new Error('国土地理院住所検索APIの応答形式が不正です')
  const coordinates = (data[0] as { geometry?: { coordinates?: unknown } } | undefined)?.geometry
    ?.coordinates
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number' ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    throw new Error('住所から座標を取得できませんでした')
  }
  return { latitude: coordinates[1], longitude: coordinates[0] }
}

function hasOwn(doc: LocalSponsorDoc, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(doc, field)
}

export const localSponsorMapConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
}) => {
  const partial = (data ?? {}) as LocalSponsorDoc
  const effective = { ...(originalDoc ?? {}), ...partial }
  let normalized = isLocal(effective) ? normalizeLocalTextFields(partial) : partial
  let normalizedEffective = { ...(originalDoc ?? {}), ...normalized }

  if (isLocal(normalizedEffective) && hasValue(normalizedEffective.local_map_category)) {
    const address = blankToNull(normalizedEffective.address)
    const addressChanged =
      hasOwn(partial, 'address') && address !== blankToNull(originalDoc?.address)
    const coordinatesExplicitlyProvided =
      hasOwn(partial, 'local_latitude') && hasOwn(partial, 'local_longitude')
    const needsGeocode =
      !validCoordinatePair(normalizedEffective) ||
      (addressChanged && !coordinatesExplicitlyProvided)

    if (needsGeocode) {
      if (typeof address !== 'string') {
        throw new ValidationError({
          collection: 'sponsors',
          errors: [{ path: 'address', message: '地図掲載には住所が必要です' }],
        })
      }
      try {
        const coordinates = await geocodeLocalSponsorAddress(address)
        normalized = {
          ...normalized,
          local_latitude: coordinates.latitude,
          local_longitude: coordinates.longitude,
        }
        normalizedEffective = { ...(originalDoc ?? {}), ...normalized }
      } catch (error) {
        throw new ValidationError({
          collection: 'sponsors',
          errors: [
            {
              path: 'address',
              message: `住所から座標を取得できませんでした: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        })
      }
    }
  }

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
