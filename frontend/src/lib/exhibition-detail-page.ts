import { notFound } from 'next/navigation';
import {
  CATEGORY_VALUES,
  getExhibitionDetail,
  type ExhibitionCategory,
  type ExhibitionDetailResult,
} from '@/lib/exhibitions';
import { getCampusMapAreas } from '@/lib/campus-map';
import {
  formatOpenDays,
  getEventDayList,
  getExhibitionPerformances,
} from '@/lib/timetable';

function isExhibitionCategory(value: string): value is ExhibitionCategory {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

export async function resolveExhibition(
  id: string,
  category: string,
): Promise<ExhibitionDetailResult> {
  const exhibitionId = Number(id);
  // category を先に検証することで、未知のカテゴリでは不要な取得を発生させない
  if (!Number.isInteger(exhibitionId) || !isExhibitionCategory(category)) {
    return { kind: 'missing' };
  }
  return getExhibitionDetail(exhibitionId, category);
}

/** 公開ページと端末用ページが同じ取得・失敗時の扱いを共有する */
export async function loadExhibitionDetailPage(id: string, category: string) {
  const [result, areasResult, performancesResult, eventDays] =
    await Promise.all([
      resolveExhibition(id, category),
      getCampusMapAreas(),
      category === 'stage' && Number.isInteger(Number(id))
        ? getExhibitionPerformances(Number(id))
        : null,
      category === 'stage' ? null : getEventDayList(),
    ]);

  if (result.kind === 'missing') {
    notFound();
  }

  // 取得失敗の描画は再検証までキャッシュされ古い正常なページを上書きするため、
  // 404 にもエラー表示にもせず例外にして古いページを保つ (要件 5.9)
  if (
    result.kind === 'error' ||
    areasResult.kind === 'error' ||
    performancesResult?.kind === 'error' ||
    (category !== 'stage' && eventDays === null)
  ) {
    throw new Error('企画詳細の取得に失敗しました');
  }

  const exhibition = result.value;
  return {
    exhibition,
    areas: areasResult.value,
    performances:
      performancesResult?.kind === 'loaded' ? performancesResult.value : null,
    openDays: eventDays
      ? formatOpenDays(exhibition.openDayKeys, eventDays)
      : null,
  };
}
