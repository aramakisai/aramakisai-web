import type { CollectionBeforeOperationHook, CollectionBeforeValidateHook, Field } from 'payload'
import { ValidationError } from 'payload'

import { executiveOnlyField } from '../access/payload-access'
import { isStudentExhibitor, toCmsUser } from '../access/roles'
import {
  newImageIds,
  toJstDateKey,
  toSlotWindow,
  validateBoothPlacement,
  validateCategoryBoothPlacements,
  validateCategoryContents,
  validateImageCount,
  validateImageOwnership,
  validateOwnerRole,
  validateOwnerUniqueness,
  validatePerformanceOverlap,
  validatePerformanceSlot,
  validateSlotEventDate,
  validateSlotRange,
  type PerformanceWindow,
  validateStageAssignment,
  validateStageCategoryRemoval,
  type ConstraintViolation,
} from './constraints'

function raise(collection: string, violations: readonly ConstraintViolation[]): void {
  if (violations.length === 0) return
  throw new ValidationError({
    collection,
    errors: violations.map(({ field, message }) => ({ path: field, message })),
  })
}

function executiveOnlyPaths(fields: readonly Field[], prefix: string[] = []): string[][] {
  return fields.flatMap((field) => {
    if (!('name' in field) || !field.name) return []
    const path = [...prefix, field.name]
    if ((field as { access?: { update?: unknown } }).access?.update === executiveOnlyField) return [path]
    return field.type === 'group' ? executiveOnlyPaths(field.fields, path) : []
  })
}

function valueAt(source: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((v, key) => (v as Record<string, unknown> | null | undefined)?.[key], source)
}

/**
 * 版の復元では、更新権限のない項目が復元データから除かれ、通常の更新と違って現在値での
 * 補完も行われない。必須項目 (owner・categories) が欠けて検証に落ちるため、学生団体の復元では
 * 実行委員専用の項目を現在のレコードの値で埋める (版が持つ割当値は反映しない)。
 */
export const keepExecutiveOnlyOnRestore: CollectionBeforeValidateHook = ({
  collection,
  context,
  data,
  originalDoc,
  req,
}) => {
  if (!context?.isRestoringVersion || !data || !isStudentExhibitor(toCmsUser(req.user))) return data

  if (!collection) return data
  for (const path of executiveOnlyPaths(collection.fields)) {
    const parent = path.slice(0, -1).reduce<Record<string, unknown>>((node, key) => {
      node[key] ??= {}
      return node[key] as Record<string, unknown>
    }, data)
    parent[path[path.length - 1]] = valueAt(originalDoc, path)
  }
  return data
}

export const performanceSlotConstraint: CollectionBeforeValidateHook = ({ data }) => {
  raise('performance_slots', validatePerformanceSlot(data ?? {}))
  return data
}

export const categoryContentsConstraint: CollectionBeforeValidateHook = ({ data, req }) => {
  raise(
    'student_exhibitions',
    validateCategoryContents(data ?? {}, {
      isStudentExhibitor: isStudentExhibitor(toCmsUser(req.user)),
    }),
  )
  return data
}

/** 出演枠が参照する企画のカテゴリを引いて、ステージ未選択の企画への割り当てを拒否する。 */
export const stageAssignmentConstraint: CollectionBeforeValidateHook = async ({ data, req }) => {
  const exhibitionId = data?.exhibition_id
  const exhibitionCategories =
    exhibitionId == null || exhibitionId === ''
      ? null
      : ((
          await req.payload.findByID({
            collection: 'student_exhibitions',
            id: exhibitionId as string | number,
            depth: 0,
            req,
          })
        )?.categories ?? [])

  raise('performance_slots', validateStageAssignment(data ?? {}, { exhibitionCategories }))
  return data
}

/** 更新対象の企画に割り当て済みの出演枠があるかを引いて、ステージ選択の解除を拒否する。 */
export const stageCategoryConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const exhibitionId = originalDoc?.id
  const hasPerformanceSlots = exhibitionId
    ? (
        await req.payload.find({
          collection: 'performance_slots',
          depth: 0,
          limit: 1,
          pagination: false,
          req,
          where: { exhibition_id: { equals: exhibitionId } },
        })
      ).docs.length > 0
    : false

  raise('student_exhibitions', validateStageCategoryRemoval(data ?? {}, { hasPerformanceSlots }))
  return data
}

/**
 * Payload には部分 UNIQUE INDEX に対応する宣言がないため、書き込み前に重複を引いて判定する。
 * DB 側の索引はマイグレーションで別途張るが、違反フィールドを特定したメッセージはここでしか返せない。
 */
export const sponsorBoothPlacementConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const areaId = data?.area_id
  const boothNumber = data?.booth_number
  if (areaId == null || boothNumber == null || boothNumber === '') return data

  const duplicates = await req.payload.find({
    collection: 'sponsors',
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    where: {
      and: [
        { area_id: { equals: areaId } },
        { booth_number: { equals: boothNumber } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
  })

  raise(
    'sponsors',
    validateBoothPlacement(data ?? {}, { duplicateExists: duplicates.docs.length > 0 }),
  )
  return data
}

const BOOTH_CATEGORIES = ['exhibit', 'vendor', 'other'] as const

/** 学生企画の配置はカテゴリのグループごとに持つ。別企画との重複は DB を、同一企画内は値同士を比べる。 */
export const exhibitionBoothPlacementConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const placements = BOOTH_CATEGORIES.map((key) => ({
    key,
    value: data?.[key] as { area_id?: unknown; booth_number?: unknown } | null | undefined,
  }))

  const duplicateKeys = new Set<string>()
  for (const { key, value } of placements) {
    if (value?.area_id == null || value?.booth_number == null || value.booth_number === '') continue
    const duplicates = await req.payload.find({
      collection: 'student_exhibitions',
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      where: {
        and: [
          { [`${key}.area_id`]: { equals: value.area_id } },
          { [`${key}.booth_number`]: { equals: value.booth_number } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
    })
    if (duplicates.docs.length > 0) duplicateKeys.add(key)
  }

  raise('student_exhibitions', validateCategoryBoothPlacements(placements, { duplicateKeys }))
  return data
}

/**
 * owner の指定は実行委員限定 (フィールド access) だが、判定はロール・重複とも Local API
 * (overrideAccess) 経由の書き込みも同じ経路を通す必要があるため beforeValidate に置く。
 */
export const ownerConstraint: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const ownerId = data?.owner
  if (ownerId == null || ownerId === '') return data

  const ownerUser = await req.payload
    .findByID({
      collection: 'users',
      id: ownerId as string | number,
      depth: 0,
      disableErrors: true,
      req,
    })
    .catch(() => null)

  const roleViolations = validateOwnerRole(data ?? {}, {
    ownerIsStudentExhibitor: ownerUser?.role === 'student_exhibitor',
  })
  if (roleViolations.length > 0) {
    raise('student_exhibitions', roleViolations)
    return data
  }

  const duplicates = await req.payload.find({
    collection: 'student_exhibitions',
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    where: {
      and: [
        { owner: { equals: ownerId } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
  })
  const duplicate = duplicates.docs[0] as { organization_name?: string } | undefined

  raise(
    'student_exhibitions',
    validateOwnerUniqueness(data ?? {}, {
      duplicateOwner: duplicate
        ? { email: ownerUser?.email ?? '', organizationName: duplicate.organization_name ?? '' }
        : null,
    }),
  )
  return data
}

/**
 * 画像枚数の上限 (M-E07) は全員対象。所有者チェック (M-E17) は学生団体のリクエストだけが対象
 * (実行委員・Local API は他団体の画像も差し替えられる必要があるため)。
 */
export const imageConstraint: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const doc = (data ?? {}) as Parameters<typeof validateImageCount>[0]
  const violations: ConstraintViolation[] = [...validateImageCount(doc)]

  if (isStudentExhibitor(toCmsUser(req.user))) {
    const candidateIds = newImageIds(doc, (originalDoc ?? {}) as typeof doc)
    if (candidateIds.length > 0) {
      const owned = await req.payload.find({
        collection: 'media',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
        where: { id: { in: candidateIds as (string | number)[] } },
      })
      const authorizedIds = new Set(
        owned.docs
          .filter((m) => String(m.owner ?? '') === String(req.user?.id ?? ''))
          .map((m) => String(m.id)),
      )
      const unauthorizedImageIds = new Set(
        candidateIds.map(String).filter((id) => !authorizedIds.has(id)),
      )
      violations.push(...validateImageOwnership(doc, { unauthorizedImageIds }))
    }
  }

  raise('student_exhibitions', violations)
  return data
}

function idOf(value: unknown): string | number | undefined {
  const v = value !== null && typeof value === 'object' ? (value as { id?: unknown }).id : value
  return typeof v === 'string' || typeof v === 'number' ? v : undefined
}

/**
 * 部分更新でも判定できるよう既存値と送信値を合成して検証する。範囲 → 開催日程 → 重なりの順で、
 * 前段に違反があれば DB を引かずに返す。
 */
export const performanceTimeConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const merged = { ...originalDoc, ...data } as Record<string, unknown>

  const rangeViolations = validateSlotRange(merged)
  if (rangeViolations.length > 0) {
    raise('performance_slots', rangeViolations)
    return data
  }

  const meta = await req.payload.findGlobal({ slug: 'site_settings', depth: 0, req })
  const eventDayKeys = (meta.event_days ?? []).flatMap((d) => toJstDateKey(d.start_at) ?? [])
  const dateViolations = validateSlotEventDate(merged, { eventDayKeys })
  if (dateViolations.length > 0) {
    raise('performance_slots', dateViolations)
    return data
  }

  const target = toSlotWindow(merged)
  const stageId = idOf(merged.stage_id)
  if (target === null || stageId === undefined) return data

  const selfId = idOf(originalDoc)
  const found = await req.payload.find({
    collection: 'performance_slots',
    depth: 1,
    pagination: false,
    req,
    where: {
      and: [
        { stage_id: { equals: stageId } },
        ...(selfId !== undefined ? [{ id: { not_equals: selfId } }] : []),
      ],
    },
  })
  const others = found.docs.flatMap((doc): PerformanceWindow[] => {
    const window = toSlotWindow(doc)
    if (window === null) return []
    const exhibition = doc.exhibition_id
    const organizationName =
      exhibition !== null && typeof exhibition === 'object' ? exhibition.organization_name : null
    return [{ ...window, performanceId: doc.id, name: organizationName || doc.title || '' }]
  })

  raise('performance_slots', validatePerformanceOverlap(target, { others }))
  return data
}
