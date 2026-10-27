'use client';

import { useDocumentInfo, useFormFields } from '@payloadcms/ui';
import { useState } from 'react';

const BUTTON = 'btn btn--style-secondary btn--size-medium';

export default function ParkingCameraTokenField() {
  const { id } = useDocumentInfo();
  const issuedAt = useFormFields(([fields]) => fields.token_issued_at?.value);
  const [issued, setIssued] = useState<boolean | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!id) return null;
  const hasToken = issued ?? Boolean(issuedAt);

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/parking_cameras/${id}/token`, { method, credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      if (method === 'POST') {
        setToken(((await res.json()) as { token: string }).token);
        setIssued(true);
      } else {
        setToken(null);
        setIssued(false);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const confirmThen = (message: string, method: 'POST' | 'DELETE') => () => {
    if (window.confirm(message)) void call(method);
  };

  return (
    <div>
      {hasToken ? (
        <>
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={confirmThen('トークンを発行し直しますか?', 'POST')}
          >
            トークンを発行し直す
          </button>{' '}
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={confirmThen('トークンを無効にしますか?', 'DELETE')}
          >
            トークンを無効にする
          </button>
        </>
      ) : (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => void call('POST')}>
          トークンを発行
        </button>
      )}
      {token && (
        <div>
          <input type="text" readOnly value={token} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%' }} />
          <p>この画面を離れると再表示できません</p>
        </div>
      )}
      {failed && <p style={{ color: 'var(--theme-error-500)' }}>更新できませんでした</p>}
    </div>
  );
}
