'use client';

import { useEffect, useRef } from 'react';
import { useDocumentInfo, useForm } from '@payloadcms/ui';

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 新規作成画面 (id 無し) でだけ、パスワード欄と確認欄に同じ乱数を 1 回自動入力する。
 * サーバー側 (replaceInitialPassword) が実際の値を差し替えるため、ここでの乱数の
 * 強度には依存しない。クライアント側の必須・一致検証を通すためだけの値。
 */
export default function AutoFillInitialPassword() {
  const { id } = useDocumentInfo();
  const { dispatchFields } = useForm();
  const filled = useRef(false);

  useEffect(() => {
    if (id || filled.current) return;
    filled.current = true;
    const value = randomPassword();
    dispatchFields({ type: 'UPDATE', path: 'password', value });
    dispatchFields({ type: 'UPDATE', path: 'confirm-password', value });
  }, [id, dispatchFields]);

  return null;
}
