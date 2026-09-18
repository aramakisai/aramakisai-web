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
