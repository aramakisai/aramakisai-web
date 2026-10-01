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

type BoothPlacementValue = {
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

type CategoryContentValue = {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly images?: unknown;
  readonly open_days?: unknown;
};

type CategoryContentsDoc = {
  readonly organization_name?: unknown;
  readonly categories?: unknown;
  readonly status?: unknown;
} & { readonly [K in ExhibitionCategory]?: CategoryContentValue | null };

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

/**
 * 学生企画はカテゴリごとに配置を持つため、同一企画内の別カテゴリ同士も衝突として扱う。
 * `placements` は (カテゴリのキー, 配置) の列で、重複判定は DB を引く呼び出し側が渡す。
 */
export function validateCategoryBoothPlacements(
  placements: readonly { readonly key: string; readonly value: BoothPlacementValue | null | undefined }[],
  { duplicateKeys }: { duplicateKeys: ReadonlySet<string> },
): readonly ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const seen = new Map<string, string>();
  for (const { key, value } of placements) {
    if (!value || !hasValue(value.area_id) || !hasValue(value.booth_number)) continue;
    const slot = `${String(value.area_id)}:${String(value.booth_number)}`;
    if (duplicateKeys.has(key) || seen.has(slot)) {
      violations.push({
        field: `${key}.booth_number`,
        message: '同じエリア内で既に使われているブース番号',
      });
    }
    seen.set(slot, key);
  }
  return violations;
}

/**
 * 実行委員は owner・categories だけ入力すれば保存できる (団体名・企画内容は代理入力の対象外) ため、
 * 通常の保存では学生団体本人にだけこの必須項目チェックを課す。ただし公開後は実行委員代理入力でも
 * 内容が揃っている必要があるため、status が published のときはロール不問で課す。非表示 (未選択
 * カテゴリ) の企画内容欄は admin.condition 側の関心事のため、選択済みカテゴリだけを見る。
 */
export function validateCategoryContents(
  doc: CategoryContentsDoc,
  { isStudentExhibitor }: { isStudentExhibitor: boolean },
): readonly ConstraintViolation[] {
  if (!isStudentExhibitor && doc.status !== 'published') return [];

  const violations: ConstraintViolation[] = [];
  if (!hasValue(doc.organization_name)) {
    violations.push({ field: 'organization_name', message: '団体名の入力が必要' });
  }

  const categories = Array.isArray(doc.categories) ? (doc.categories as unknown[]) : [];
  for (const category of categories) {
    const key = category as ExhibitionCategory;
    const label = CATEGORY_LABELS[key];
    if (!label) continue;
    if (!hasValue(doc[key]?.name)) {
      violations.push({ field: `${key}.name`, message: `${label}を選択した場合は企画名の入力が必要` });
    }
    if (!hasValue(doc[key]?.description)) {
      violations.push({ field: `${key}.description`, message: `${label}を選択した場合は紹介文の入力が必要` });
    }
    if (imageIdsOf(doc[key]?.images).length === 0) {
      violations.push({ field: `${key}.images`, message: `${label}を選択した場合は画像が1枚以上必要` });
    }
    // ステージの開催日は出演枠側で決まるため出店日を持たない
    if (key !== 'stage' && !(Array.isArray(doc[key]?.open_days) && doc[key]!.open_days!.length > 0)) {
      violations.push({ field: `${key}.open_days`, message: `${label}を選択した場合は出店日の選択が必要` });
    }
  }
  return violations;
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

type OwnerDoc = {
  readonly owner?: unknown;
};

/** owner に指定できるのは学生団体ロールのユーザーだけ。対象ユーザーの解決は呼び出し側が担う。 */
export function validateOwnerRole(
  doc: OwnerDoc,
  { ownerIsStudentExhibitor }: { ownerIsStudentExhibitor: boolean },
): readonly ConstraintViolation[] {
  if (!hasValue(doc.owner)) return [];
  if (ownerIsStudentExhibitor) return [];
  return [{ field: 'owner', message: '所有者に学生団体のアカウントを選んでください。' }];
}

/**
 * 現行スキーマの user_created UNIQUE (1 ユーザー 1 レコード) と同等。重複の有無・相手先の
 * 情報は呼び出し側が DB を引いて渡す (メッセージに他レコードのメールアドレス・団体名を含むため)。
 */
export function validateOwnerUniqueness(
  doc: OwnerDoc,
  {
    duplicateOwner,
  }: { duplicateOwner: { readonly email: string; readonly organizationName: string } | null },
): readonly ConstraintViolation[] {
  if (!hasValue(doc.owner) || !duplicateOwner) return [];
  return [
    {
      field: 'owner',
      message: `${duplicateOwner.email}は既に${duplicateOwner.organizationName}の所有者です。`,
    },
  ];
}

type CategoryImagesDoc = {
  readonly [K in ExhibitionCategory]?: { readonly images?: unknown } | null;
};

const IMAGE_CATEGORIES = Object.keys(CATEGORY_LABELS) as readonly ExhibitionCategory[];

/** upload hasMany の値は raw ID (未 populate) か populate 済みオブジェクトのどちらもあり得る。 */
function imageIdsOf(images: unknown): readonly (string | number)[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((v) => (v !== null && typeof v === 'object' ? (v as { id?: unknown }).id : v))
    .filter((v): v is string | number => v != null) as (string | number)[];
}

/** 各カテゴリの画像枚数の上限。`admin.description` の「最大5枚まで」を実際に検証する。 */
export function validateImageCount(doc: CategoryImagesDoc): readonly ConstraintViolation[] {
  return IMAGE_CATEGORIES.flatMap((category) => {
    if (imageIdsOf(doc[category]?.images).length < 6) return [];
    return [{ field: `${category}.images`, message: '画像は最大5枚です。' }];
  });
}

/**
 * 保存前後の差分から、今回新しく加わった画像 ID だけを集める (所有者チェックの対象を絞るため)。
 * create 時は originalDoc が無いため、指定済みの画像は全て新規扱いになる。
 */
export function newImageIds(
  doc: CategoryImagesDoc,
  originalDoc: CategoryImagesDoc,
): readonly (string | number)[] {
  const seen = new Set<string>();
  const result: (string | number)[] = [];
  for (const category of IMAGE_CATEGORIES) {
    const previousIds = new Set(imageIdsOf(originalDoc[category]?.images).map(String));
    for (const id of imageIdsOf(doc[category]?.images)) {
      if (previousIds.has(String(id)) || seen.has(String(id))) continue;
      seen.add(String(id));
      result.push(id);
    }
  }
  return result;
}

/** 所有者が本人でない画像 ID の集合は呼び出し側が DB を引いて渡す。 */
export function validateImageOwnership(
  doc: CategoryImagesDoc,
  { unauthorizedImageIds }: { unauthorizedImageIds: ReadonlySet<string> },
): readonly ConstraintViolation[] {
  if (unauthorizedImageIds.size === 0) return [];
  return IMAGE_CATEGORIES.flatMap((category) => {
    const hasUnauthorized = imageIdsOf(doc[category]?.images).some((id) =>
      unauthorizedImageIds.has(String(id)),
    );
    if (!hasUnauthorized) return [];
    return [
      { field: `${category}.images`, message: '【仮】自分がアップロードした画像だけを選べます。' },
    ];
  });
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST に 9 時間ずらした Date の UTC 取得関数が、そのまま JST の暦日・時刻になる。 */
function toJstShifted(value: unknown): Date | null {
  if (typeof value !== 'string' || value === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms + JST_OFFSET_MS);
}

/** ISO 文字列を JST の暦日 'YYYY-MM-DD' にする。解釈できなければ null。 */
export function toJstDateKey(value: unknown): string | null {
  return toJstShifted(value)?.toISOString().slice(0, 10) ?? null;
}

/** ISO 文字列を JST の 0 時からの分にする。解釈できなければ null。 */
export function toJstMinuteOfDay(value: unknown): number | null {
  const d = toJstShifted(value);
  return d ? d.getUTCHours() * 60 + d.getUTCMinutes() : null;
}

export type SlotWindow = {
  readonly dateKey: string;
  readonly startMinute: number;
  readonly endMinute: number;
};

export type PerformanceWindow = SlotWindow & {
  readonly performanceId: string | number;
  readonly name: string;
};

type PerformanceTimeDoc = {
  readonly event_date?: unknown;
  readonly start_at?: unknown;
  readonly end_at?: unknown;
};

export function toSlotWindow(doc: PerformanceTimeDoc): SlotWindow | null {
  const dateKey = toJstDateKey(doc.event_date);
  const startMinute = toJstMinuteOfDay(doc.start_at);
  const endMinute = toJstMinuteOfDay(doc.end_at);
  if (dateKey === null || startMinute === null || endMinute === null) return null;
  return { dateKey, startMinute, endMinute };
}

/** start_at / end_at の日付部分は意味を持たないため、JST の分だけで比べる。 */
export function validateSlotRange(doc: PerformanceTimeDoc): readonly ConstraintViolation[] {
  const start = toJstMinuteOfDay(doc.start_at);
  const end = toJstMinuteOfDay(doc.end_at);
  if (start === null || end === null || end > start) return [];
  return [{ field: 'end_at', message: '終了時刻は開始時刻より後にしてください' }];
}

export function validateSlotEventDate(
  doc: PerformanceTimeDoc,
  { eventDayKeys }: { eventDayKeys: readonly string[] },
): readonly ConstraintViolation[] {
  const dateKey = toJstDateKey(doc.event_date);
  if (dateKey === null || eventDayKeys.includes(dateKey)) return [];
  return [{ field: 'event_date', message: '開催日は祭基本情報の開催日程から選んでください' }];
}

function formatMinute(minute: number): string {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 区間は半開区間 [start, end)。終了と次の開始が同じ枠は重ならない。 */
export function validatePerformanceOverlap(
  target: SlotWindow | null,
  { others }: { others: readonly PerformanceWindow[] },
): readonly ConstraintViolation[] {
  if (target === null) return [];
  const overlaps = others.filter(
    (o) =>
      o.dateKey === target.dateKey &&
      o.startMinute < target.endMinute &&
      target.startMinute < o.endMinute,
  );
  if (overlaps.length === 0) return [];
  const list = overlaps
    .map((o) => `${o.name} ${formatMinute(o.startMinute)}〜${formatMinute(o.endMinute)}`)
    .join('、');
  return [{ field: 'start_at', message: `同じステージの出演枠と重なっています: ${list}` }];
}
