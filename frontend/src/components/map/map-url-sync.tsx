'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function Watcher({ onChange }: { readonly onChange: () => void }) {
  const search = useSearchParams().toString();
  useEffect(() => {
    onChange();
  }, [search, onChange]);
  return null;
}

// 履歴 API で自前管理している URL 状態へ、Next の Link による同一ページ内の遷移を反映する。
// useSearchParams は静的描画を CSR にバイルアウトさせるため、画面全体ではなくここだけを Suspense で囲う
export function MapUrlSync({ onChange }: { readonly onChange: () => void }) {
  return (
    <Suspense fallback={null}>
      <Watcher onChange={onChange} />
    </Suspense>
  );
}
