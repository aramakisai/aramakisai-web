'use client';

import { useEffect, useRef } from 'react';
import { useDocumentInfo, useFormFields } from '@payloadcms/ui';

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * password/confirm-password は独自の Form context 系列を持ち、useForm().dispatchFields
 * (このフィールド自身のサブツリーから呼んだもの) を送っても反映されない。ネイティブ input
 * イベントを発火させ、各フィールド自身の onChange を経由させることで確実に反映させる。
 */
function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const ENFORCE_INTERVAL_MS = 100;

/**
 * 新規作成画面 (id 無し) で、学生団体ロールのときだけパスワード欄と確認欄に同じ乱数を
 * 自動入力する。サーバー側 (replaceInitialPassword) は学生団体ロールの作成でしか値を
 * 差し替えないため、他ロール (実行委員) では自動入力を止め、入力したパスワードをそのまま
 * 使わせる。マウント直後だけでなく、他フィールドの入力をきっかけに form 側が両欄を
 * 空へ巻き戻すことがあるため、ドキュメント作成が完了する (id が付く=アンマウントされる) まで
 * 空になるたび入れ直し続ける。
 */
export default function AutoFillInitialPassword() {
  const { id } = useDocumentInfo();
  const role = useFormFields(([fields]) => fields.role?.value);
  const valueRef = useRef<string>(randomPassword());

  useEffect(() => {
    if (id) return;
    if (role !== 'student_exhibitor') return;
    const value = valueRef.current;
    const timer = window.setInterval(() => {
      const password = document.getElementById('field-password');
      const confirmPassword = document.getElementById('field-confirm-password');
      if (!(password instanceof HTMLInputElement) || !(confirmPassword instanceof HTMLInputElement)) return;
      if (password.value !== value) setNativeInputValue(password, value);
      if (confirmPassword.value !== value) setNativeInputValue(confirmPassword, value);
    }, ENFORCE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [id, role]);

  return null;
}
