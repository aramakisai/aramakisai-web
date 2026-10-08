'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect } from 'react';

import { reloadPin, useSignagePin } from './useSignagePin';

export default function SignagePinButton() {
  const { id, savedDocumentData } = useDocumentInfo();
  const enabled = savedDocumentData?.enabled;
  const { pinnedId, saving, failedId, pin } = useSignagePin();
  // 無効にして保存すると afterChange が固定を外すため、保存後の状態を読み直す
  useEffect(() => {
    if (enabled === false) void reloadPin();
  }, [enabled]);
  if (!id) return null;
  const isPinned = pinnedId === Number(id);

  return (
    <div>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-medium"
        disabled={saving || pinnedId === undefined || (!isPinned && !enabled)}
        onClick={() => void pin(isPinned ? null : Number(id))}
      >
        {isPinned ? '固定表示を解除する' : 'このスライドを固定表示する'}
      </button>
      {failedId !== undefined && <p style={{ color: 'var(--theme-error-500)' }}>更新できませんでした</p>}
    </div>
  );
}
