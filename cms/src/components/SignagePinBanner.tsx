'use client';

import { useEffect, useState } from 'react';

import { useSignagePin } from './useSignagePin';

export default function SignagePinBanner() {
  const { pinnedId, saving, failedId, pin } = useSignagePin();
  const [loaded, setLoaded] = useState<{ id: number; title: string | null } | null>(null);
  const title = loaded && loaded.id === pinnedId ? loaded.title : null;

  useEffect(() => {
    if (!pinnedId) return;
    let alive = true;
    fetch(`/api/signage_slides/${pinnedId}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => alive && setLoaded({ id: pinnedId, title: doc?.title ?? null }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pinnedId]);

  if (pinnedId === undefined) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--base)',
        padding: 'calc(var(--base) / 2) var(--base)',
        marginBottom: 'var(--base)',
        background: 'var(--theme-elevation-100)',
        borderRadius: 'var(--style-radius-s)',
      }}
    >
      <span>{pinnedId ? `固定表示中: ${title ?? ''}` : '固定表示なし(通常の巡回中)'}</span>
      {pinnedId ? (
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={saving}
          onClick={() => void pin(null)}
        >
          解除
        </button>
      ) : null}
      {failedId !== undefined && <span style={{ color: 'var(--theme-error-500)' }}>更新できませんでした</span>}
    </div>
  );
}
