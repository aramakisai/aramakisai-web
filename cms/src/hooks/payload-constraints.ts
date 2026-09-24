import type { CollectionBeforeOperationHook, CollectionBeforeValidateHook } from 'payload';
import { APIError, ValidationError } from 'payload';

import { isStudentExhibitor, toCmsUser } from '../access/roles';
import {
  newImageIds,
  validateBoothPlacement,
  validateCategoryContents,
  validateImageCount,
  validateImageOwnership,
  validateOwnerRole,
  validateOwnerUniqueness,
  validatePerformanceSlot,
  validateStageAssignment,
  validateStageCategoryRemoval,
  type ConstraintViolation,
} from './constraints';

function raise(collection: string, violations: readonly ConstraintViolation[]): void {
  if (violations.length === 0) return;
  throw new ValidationError({
    collection,
    errors: violations.map(({ field, message }) => ({ path: field, message })),
  });
}

export const performanceSlotConstraint: CollectionBeforeValidateHook = ({ data }) => {
  raise('performance_slots', validatePerformanceSlot(data ?? {}));
  return data;
};

export const categoryContentsConstraint: CollectionBeforeValidateHook = ({ data }) => {
  raise('student_exhibitions', validateCategoryContents(data ?? {}));
  return data;
};

/** 出演枠が参照する企画のカテゴリを引いて、ステージ未選択の企画への割り当てを拒否する。 */
export const stageAssignmentConstraint: CollectionBeforeValidateHook = async ({ data, req }) => {
  const exhibitionId = data?.exhibition_id;
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
        )?.categories ?? []);

  raise('performance_slots', validateStageAssignment(data ?? {}, { exhibitionCategories }));
  return data;
};

/** 更新対象の企画に割り当て済みの出演枠があるかを引いて、ステージ選択の解除を拒否する。 */
export const stageCategoryConstraint: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const exhibitionId = originalDoc?.id;
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
    : false;

  raise('student_exhibitions', validateStageCategoryRemoval(data ?? {}, { hasPerformanceSlots }));
  return data;
};

/**
 * Payload には部分 UNIQUE INDEX に対応する宣言がないため、書き込み前に重複を引いて判定する。
 * DB 側の索引はマイグレーションで別途張るが、違反フィールドを特定したメッセージはここでしか返せない。
 */
export function boothPlacementConstraint(
  collection: 'student_exhibitions' | 'sponsors',
): CollectionBeforeValidateHook {
  return async ({ data, originalDoc, req }) => {
    const areaId = data?.area_id;
    const boothNumber = data?.booth_number;
    if (areaId == null || boothNumber == null) return data;

    const duplicates = await req.payload.find({
      collection,
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
    });

    raise(
      collection,
      validateBoothPlacement(data ?? {}, { duplicateExists: duplicates.docs.length > 0 }),
    );
    return data;
  };
}

/**
 * owner の指定は実行委員限定 (フィールド access) だが、判定はロール・重複とも Local API
 * (overrideAccess) 経由の書き込みも同じ経路を通す必要があるため beforeValidate に置く。
 */
export const ownerConstraint: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const ownerId = data?.owner;
  if (ownerId == null || ownerId === '') return data;

  const ownerUser = await req.payload
    .findByID({
      collection: 'users',
      id: ownerId as string | number,
      depth: 0,
      disableErrors: true,
      req,
    })
    .catch(() => null);

  const roleViolations = validateOwnerRole(data ?? {}, {
    ownerIsStudentExhibitor: ownerUser?.role === 'student_exhibitor',
  });
  if (roleViolations.length > 0) {
    raise('student_exhibitions', roleViolations);
    return data;
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
  });
  const duplicate = duplicates.docs[0] as { organization_name?: string } | undefined;

  raise(
    'student_exhibitions',
    validateOwnerUniqueness(data ?? {}, {
      duplicateOwner: duplicate
        ? { email: ownerUser?.email ?? '', organizationName: duplicate.organization_name ?? '' }
        : null,
    }),
  );
  return data;
};

/**
 * 画像枚数の上限 (M-E07) は全員対象。所有者チェック (M-E17) は学生団体のリクエストだけが対象
 * (実行委員・Local API は他団体の画像も差し替えられる必要があるため)。
 */
export const imageConstraint: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const doc = (data ?? {}) as Parameters<typeof validateImageCount>[0];
  const violations: ConstraintViolation[] = [...validateImageCount(doc)];

  if (isStudentExhibitor(toCmsUser(req.user))) {
    const candidateIds = newImageIds(doc, (originalDoc ?? {}) as typeof doc);
    if (candidateIds.length > 0) {
      const owned = await req.payload.find({
        collection: 'media',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
        where: { id: { in: candidateIds as (string | number)[] } },
      });
      const authorizedIds = new Set(
        owned.docs
          .filter((m) => String(m.owner ?? '') === String(req.user?.id ?? ''))
          .map((m) => String(m.id)),
      );
      const unauthorizedImageIds = new Set(
        candidateIds.map(String).filter((id) => !authorizedIds.has(id)),
      );
      violations.push(...validateImageOwnership(doc, { unauthorizedImageIds }));
    }
  }

  raise('student_exhibitions', violations);
  return data;
};

/**
 * access 評価 (Where で published を除外) より前に案内付きで拒否するため beforeOperation に置く。
 * 本人の企画でなければ何もせず、後段の access に Forbidden を任せる (他団体の公開状態を漏らさない)。
 */
export const guardPublishedExhibition: CollectionBeforeOperationHook = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'update' || overrideAccess === true) return;
  if (!isStudentExhibitor(toCmsUser(req.user))) return;

  const id = (args as { id?: string | number }).id;
  if (id == null) return;

  const doc = await req.payload
    .findByID({ collection: 'student_exhibitions', id, depth: 0, overrideAccess: true, req })
    .catch(() => null);
  if (!doc) return;

  const ownerId =
    doc.owner !== null && typeof doc.owner === 'object'
      ? (doc.owner as { id?: unknown }).id
      : doc.owner;
  if (String(ownerId) !== String(req.user?.id) || doc.status !== 'published') return;

  throw new APIError('公開中の企画のため、修正は実行委員に依頼してください。', 403, undefined, true);
};
