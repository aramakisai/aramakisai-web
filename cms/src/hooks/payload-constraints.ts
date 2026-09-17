import type { CollectionBeforeValidateHook } from 'payload';
import { ValidationError } from 'payload';

import {
  validateBoothPlacement,
  validatePerformanceSlot,
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
