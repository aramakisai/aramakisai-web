'use client';

import { useRowLabel } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Row = { page?: number | { id: number; title?: string } | null; label?: string | null };

const titles = new Map<number, string>();

export default function NavigationRowLabel() {
  const { data } = useRowLabel<Row>();
  const page = data?.page;
  const id = typeof page === 'object' && page ? page.id : page;
  const [title, setTitle] = useState<string | undefined>(typeof id === 'number' ? titles.get(id) : undefined);

  useEffect(() => {
    if (typeof id !== 'number') return setTitle(undefined);
    const cached = titles.get(id);
    if (cached) return setTitle(cached);
    let alive = true;
    fetch(`/api/pages/${id}?depth=0&select[title]=true`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((p: { title?: string } | undefined) => {
        if (!p?.title) return;
        titles.set(id, p.title);
        if (alive) setTitle(p.title);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  return <span>{(typeof id === 'number' ? title : undefined) || data?.label || '(未設定)'}</span>;
}
