import type { FaqItem } from '@/cms-types';
import { cms } from './cms';

export interface FaqEntry {
  readonly id: number;
  readonly question: string;
  readonly answer: string;
  readonly updatedAt: string;
}

function formatFaqItem(item: FaqItem): FaqEntry {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    updatedAt: item.updatedAt,
  };
}

export async function getFaqItems(): Promise<FaqEntry[]> {
  const result = await cms.findMany('faq_items', {
    sort: ['sort'],
    limit: 0,
    depth: 0,
  });
  if (!result.ok) throw new Error('よくある質問の取得に失敗しました');
  return result.value.docs.map(formatFaqItem);
}
