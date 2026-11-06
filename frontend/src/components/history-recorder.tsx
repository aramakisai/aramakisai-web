'use client';

import { useEffect } from 'react';
import type { ExhibitionCategory } from '@/lib/exhibitions';
import { recordHistory } from '@/lib/mypage-storage';

export interface HistoryRecorderProps {
  readonly exhibitionId: number;
  readonly category: ExhibitionCategory;
}

export function HistoryRecorder({
  exhibitionId,
  category,
}: HistoryRecorderProps) {
  useEffect(() => {
    // 保存できなくても詳細ページの表示は続けるため戻り値は見ない
    recordHistory(exhibitionId, category);
  }, [exhibitionId, category]);

  return null;
}
