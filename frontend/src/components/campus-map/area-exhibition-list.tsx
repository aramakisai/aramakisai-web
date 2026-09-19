import { ExhibitionCard } from '@/components/exhibition-card';
import {
  CATEGORY_LABELS,
  type ExhibitionCardSummary,
  type ExhibitionCategory,
} from '@/lib/exhibitions';

/**
 * リストの表示状態。
 * `filtered` はエリア・キーワード・カテゴリの任意の組み合わせを表す。
 * 条件が 1 つも指定されていない場合は `unselected` になる。
 */
export type AreaExhibitionListState =
  | { readonly kind: 'unselected' }
  | { readonly kind: 'no-area' }
  | {
      readonly kind: 'filtered';
      /** 選択中のエリア名。エリアが選ばれていなければ null */
      readonly areaName: string | null;
      readonly keyword: string;
      readonly categories: readonly ExhibitionCategory[];
      readonly items: readonly ExhibitionCardSummary[];
    }
  | { readonly kind: 'error'; readonly message: string };

export interface AreaExhibitionListProps {
  readonly state: AreaExhibitionListState;
  /**
   * state とは独立した注意書き (例: map_areas 取得失敗時)。`error` と異なりリスト本体の
   * 表示は妨げない (要件 8.1 は地図と一覧の両方を維持したまま伝えることを求める)
   */
  readonly notice?: string | null;
}

type FilteredState = Extract<AreaExhibitionListState, { kind: 'filtered' }>;

/**
 * エリアのみが条件のときは「エリアに出展物がない」(要件 3.8) 、それ以外は
 * 「条件の変更を促す」(要件 4.7) という別の 0 件案内になるため、この組み合わせだけ判定する。
 */
function isAreaOnly(state: FilteredState): boolean {
  return (
    state.areaName !== null &&
    state.keyword === '' &&
    state.categories.length === 0
  );
}

export interface ListHeading {
  /** エリア名・キーワード・カテゴリを併記した見出し本体 */
  readonly heading: string;
  readonly count: string;
}

/**
 * 適用中の条件と件数から見出しを組み立てる。
 * Figma (AreaExhibitionList / Header) は見出し本体と件数を別要素として持つ 2 段構成のため、
 * ここでも 1 つの文字列にせず分けて返す。
 */
export function buildListHeading(state: FilteredState): ListHeading {
  const segments: string[] = [];
  if (state.areaName) segments.push(state.areaName);
  if (state.keyword) segments.push(`「${state.keyword}」`);
  if (state.categories.length > 0) {
    segments.push(state.categories.map((c) => CATEGORY_LABELS[c]).join('・'));
  }
  return { heading: segments.join(' '), count: `${state.items.length}件` };
}

export function AreaExhibitionList({ state, notice }: AreaExhibitionListProps) {
  const listHeading = state.kind === 'filtered' ? buildListHeading(state) : null;
  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      {notice && <p>{notice}</p>}
      {state.kind === 'unselected' && (
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-base font-bold text-text">
            エリアを選択してください
          </h2>
          <p>地図上のブロックをタップすると、そこで開催している企画が表示されます</p>
        </div>
      )}
      {state.kind === 'no-area' && <p>エリアはまだ登録されていません</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}
      {state.kind === 'filtered' && (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-text">
              {listHeading?.heading}
            </h2>
            <p className="text-sm text-gray-500">{listHeading?.count}</p>
          </div>
          {state.items.length === 0 ? (
            <p>
              {isAreaOnly(state)
                ? 'このエリアに出展物はありません'
                : '条件に一致する出展物はありません。条件を変更してください'}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {state.items.map((item) => (
                <ExhibitionCard
                  key={`${item.id}-${item.category}`}
                  exhibition={item}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
