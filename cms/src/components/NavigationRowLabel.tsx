'use client';

import { useRowLabel } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Row = { link_type?: string | null; page?: number | { id: number; title?: string } | null; label?: string | null };

const titles = new Map<number, string>();

export default function NavigationRowLabel() {
  const { data } = useRowLabel<Row>();
  const page = data?.link_type === 'page' ? data.page : undefined;
  const id = typeof page === 'object' && page ? page.id : page;
  const [, bump] = useState(0);

  useEffect(() => {
    if (typeof id !== 'number' || titles.has(id)) return;
    let alive = true;
    fetch(`/api/pages/${id}?depth=0&select[title]=true`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((p: { title?: string } | undefined) => {
        if (!p?.title) return;
        titles.set(id, p.title);
        if (alive) bump((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  const title = typeof id === 'number' ? titles.get(id) : undefined;
  return <span>{title || data?.label || '(未設定)'}</span>;
}
