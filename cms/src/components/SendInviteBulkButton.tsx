'use client';

import { ConfirmationModal, toast, useAuth, useConfig, useModal } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MODAL_SLUG = 'send-invite-bulk';

/** 一覧上部に置く。単件送信と同じ resend_invite 経路 (captureResendInvite) を where 付き PATCH で使う */
export default function SendInviteBulkButton() {
  const { user } = useAuth();
  const { config } = useConfig();
  const { openModal, closeModal } = useModal();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (user?.role !== 'executive') return null;

  const send = async () => {
    setBusy(true);
    try {
      const query = '?where[role][equals]=student_exhibitor&where[activated_at][exists]=false';
      const res = await fetch(`${config.routes.api}/users${query}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resend_invite: true }),
      });
      const body = (await res.json()) as { docs?: unknown[]; errors?: unknown[] };
      if (!res.ok) throw new Error(String(res.status));
      toast.success(`${body.docs?.length ?? 0} 件の招待メールを送信キューに追加しました`);
      closeModal(MODAL_SLUG);
      // 一覧は server component のため、招待メール列の更新には再取得が要る
      router.refresh();
    } catch {
      toast.error('送信に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-medium"
        disabled={busy}
        onClick={() => openModal(MODAL_SLUG)}
      >
        未アクティベートのユーザー全員に招待メールを送信
      </button>
      <ConfirmationModal
        modalSlug={MODAL_SLUG}
        heading="招待メールを一斉送信"
        body="未アクティベートの学生団体ユーザー全員に招待メールを送信します。"
        confirmLabel="送信"
        onConfirm={send}
      />
    </div>
  );
}
