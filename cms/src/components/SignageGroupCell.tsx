'use client';

import type { DefaultCellComponentProps } from 'payload';

import { isSlideVisible } from './signage-groups';
import { useSignageGroups } from './useSignageGroups';

export default function SignageGroupCell({ rowData }: DefaultCellComponentProps) {
  const { groups } = useSignageGroups();
  if (!groups) return null;
  const id = rowData?.id as number;
  // 「すべて」は全行に出て邪魔なため名前に含めない
  const names = groups.filter((g) => !g.is_all && g.slides.includes(id)).map((g) => g.name);
  const visible = isSlideVisible({ id, enabled: rowData?.enabled }, groups);

  return (
    <span>
      {names.join('、')}
      {!visible && <span style={{ marginLeft: 8, color: 'var(--theme-warning-600)' }}>表示されません</span>}
    </span>
  );
}
