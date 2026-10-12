'use client';

import Link from 'next/link';

import { useSignageGroups } from './useSignageGroups';

export default function SignageGroupSwitches() {
  const { groups, total, saving, failedId, toggle } = useSignageGroups();
  if (!groups) return null;
  const allVisible = groups.some((g) => g.is_all && g.visible);

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--base)' }}>
      {groups.map((g) => (
        <li
          key={g.id}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--base)', padding: 'calc(var(--base) / 4) 0' }}
        >
          <input
            type="checkbox"
            role="switch"
            aria-label={`${g.name}を表示する`}
            checked={g.visible}
            disabled={saving}
            onChange={(e) => void toggle(g.id, e.target.checked)}
          />
          <span>{g.name}</span>
          <span>{g.is_all ? total : g.slides.length}枚</span>
          {!g.visible && <span style={{ color: 'var(--theme-elevation-500)' }}>非表示中</span>}
          {!g.is_all && !g.visible && allVisible && (
            <span style={{ color: 'var(--theme-elevation-500)' }}>「すべて」が表示中のため表示されます</span>
          )}
          <Link href={`/admin/collections/signage_groups/${g.id}`}>編集</Link>
          {failedId === g.id && <span style={{ color: 'var(--theme-error-500)' }}>更新できませんでした</span>}
        </li>
      ))}
    </ul>
  );
}
