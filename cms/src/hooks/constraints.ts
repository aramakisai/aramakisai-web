export type ConstraintViolation = {
  readonly field: string;
  readonly message: string;
};

type PerformanceSlotDoc = {
  readonly exhibition_id?: unknown;
  readonly title?: unknown;
};

type BoothDoc = {
  readonly area_id?: unknown;
  readonly booth_number?: unknown;
};

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/** 現行 custom migration の CHECK 制約 (exhibition_id IS NOT NULL OR title IS NOT NULL) と同等。 */
export function validatePerformanceSlot(
  doc: PerformanceSlotDoc,
): readonly ConstraintViolation[] {
  if (hasValue(doc.exhibition_id) || hasValue(doc.title)) return [];
  return [{ field: 'title', message: 'exhibition_id か title の少なくとも一方が必要' }];
}

/**
 * 現行の部分 UNIQUE INDEX (area_id, booth_number) WHERE 両方 NOT NULL と同等。
 * 重複の有無は DB を引く呼び出し側から渡す。
 */
export function validateBoothPlacement(
  doc: BoothDoc,
  { duplicateExists }: { duplicateExists: boolean },
): readonly ConstraintViolation[] {
  if (!hasValue(doc.area_id) || !hasValue(doc.booth_number)) return [];
  if (!duplicateExists) return [];
  return [
    { field: 'booth_number', message: '同じエリア内で既に使われているブース番号' },
  ];
}
