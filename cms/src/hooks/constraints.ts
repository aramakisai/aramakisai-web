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

const CATEGORY_LABELS = {
  stage: 'ステージ',
  exhibit: '展示',
  vendor: '出店',
  other: 'その他',
} as const;

type ExhibitionCategory = keyof typeof CATEGORY_LABELS;

type CategoryContentsDoc = {
  readonly categories?: unknown;
} & { readonly [K in ExhibitionCategory]?: { readonly name?: unknown } | null };

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

/** 非表示 (未選択カテゴリ) の企画内容欄は admin.condition 側の関心事のため、ここでは選択済みカテゴリだけを見る。 */
export function validateCategoryContents(
  doc: CategoryContentsDoc,
): readonly ConstraintViolation[] {
  const categories = Array.isArray(doc.categories) ? (doc.categories as unknown[]) : [];
  return categories.flatMap((category) => {
    const key = category as ExhibitionCategory;
    const label = CATEGORY_LABELS[key];
    if (!label) return [];
    if (hasValue(doc[key]?.name)) return [];
    return [{ field: `${key}.name`, message: `${label}を選択した場合は企画名の入力が必要` }];
  });
}

type StageAssignmentDoc = {
  readonly exhibition_id?: unknown;
};

/**
 * 出演枠に紐づく企画のカテゴリは呼び出し側が DB から引いて渡す。exhibition_id 未指定
 * (団体なし出演) は、その他のバリデーション (validatePerformanceSlot) の対象であり
 * ここでは無関係なので null を渡して判定をスキップする。
 */
export function validateStageAssignment(
  doc: StageAssignmentDoc,
  { exhibitionCategories }: { exhibitionCategories: readonly unknown[] | null },
): readonly ConstraintViolation[] {
  if (!hasValue(doc.exhibition_id)) return [];
  if (exhibitionCategories === null) return [];
  if (exhibitionCategories.includes('stage')) return [];
  return [
    { field: 'exhibition_id', message: 'ステージを選択していない企画は出演枠に割り当てられません' },
  ];
}

type StageCategoryDoc = {
  readonly categories?: unknown;
};

/** 出演枠の割り当ての有無は呼び出し側が DB から引いて渡す。 */
export function validateStageCategoryRemoval(
  doc: StageCategoryDoc,
  { hasPerformanceSlots }: { hasPerformanceSlots: boolean },
): readonly ConstraintViolation[] {
  if (!hasPerformanceSlots) return [];
  const categories = Array.isArray(doc.categories) ? (doc.categories as unknown[]) : [];
  if (categories.includes('stage')) return [];
  return [
    { field: 'categories', message: '出演枠が割り当てられているためステージの選択を外せません' },
  ];
}
