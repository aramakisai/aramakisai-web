import type { CollectionBeforeValidateHook } from 'payload';
import { ValidationError } from 'payload';

import {
  validateBoothPlacement,
  validateCategoryContents,
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
