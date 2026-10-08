'use client';

import type { DefaultCellComponentProps } from 'payload';

import { useSignagePin } from './useSignagePin';

export default function SignagePinCell({ rowData }: DefaultCellComponentProps) {
  const { pinnedId, saving, failedId, pin } = useSignagePin();
  const id = rowData?.id as number;
  return (
    <>
      <input
        type="radio"
        name="signage-pin"
        aria-label="固定表示する"
        checked={pinnedId === id}
        disabled={saving || pinnedId === undefined || !rowData?.enabled}
        onChange={() => void pin(id)}
      />
      {failedId === id && <span style={{ color: 'var(--theme-error-500)' }}> 失敗</span>}
    </>
  );
}
