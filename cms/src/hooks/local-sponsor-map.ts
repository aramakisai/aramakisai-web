import type { CollectionBeforeValidateHook } from 'payload'
import { ValidationError } from 'payload'

import { blankToNull, type ConstraintViolation, hasValue } from './constraints'
import { isValidOptionalHttpUrl } from './http-url'

type LocalSponsorDoc = Record<string, unknown> & {
  readonly type?: unknown
  readonly url?: unknown
  readonly business_category?: unknown
  readonly local_latitude?: unknown
  readonly local_longitude?: unknown
  readonly address?: unknown
}

const LOCAL_TEXT_FIELDS = [
  'url',
  'address',
  'description',
  'local_business_hours',
  'local_phone',
] as const

function isLocal(doc: LocalSponsorDoc): boolean {
  return Array.isArray(doc.type) && doc.type.includes('local')
}

function normalizeLocalTextFields<T extends LocalSponsorDoc>(doc: T): T {
  const normalized: Record<string, unknown> = { ...doc }
  for (const field of LOCAL_TEXT_FIELDS) {
    if (field in doc) normalized[field] = blankToNull(doc[field])
  }
  return normalized as T
}

export function validateLocalSponsorMap(doc: LocalSponsorDoc): readonly ConstraintViolation[] {
  if (!isLocal(doc)) return []

  const violations: ConstraintViolation[] = []
  // 保存フックは空白を正規化するが、直接検証時の既存の判定は維持する。
  if (hasValue(doc.url) && (!hasValue(blankToNull(doc.url)) || !isValidOptionalHttpUrl(doc.url))) {
    violations.push({
      field: 'url',
      message: 'Webサイト URL は http または https の絶対URLにしてください',
    })
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
): Promise<{ latitude: number; longitude: number }> {
  const response = await fetch(
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

export const localSponsorMapConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
}) => {
  const partial = (data ?? {}) as LocalSponsorDoc
  const effective = { ...(originalDoc ?? {}), ...partial }
  let normalized = isLocal(effective) ? normalizeLocalTextFields(partial) : partial
  let normalizedEffective = { ...(originalDoc ?? {}), ...normalized }

  if (isLocal(normalizedEffective) && hasValue(normalizedEffective.business_category)) {
    const address = blankToNull(normalizedEffective.address)
    const addressChanged =
      Object.hasOwn(partial, 'address') && address !== blankToNull(originalDoc?.address)
    // 管理画面は全項目を送るため、住所が変わった保存では data の座標が旧住所のものでも、手入力と区別できず geocode 結果を優先する。
    const needsGeocode = !validCoordinatePair(normalizedEffective) || addressChanged

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
