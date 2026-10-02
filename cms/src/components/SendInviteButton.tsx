'use client';

import { useForm, useFormProcessing } from '@payloadcms/ui';

/**
 * resend_invite は列を持たない指示フラグ。値をフォーム状態へ書いてから submit すると
 * 反映前の状態が送られうるため、submit の overrides で送信データへ直接載せる。
 */
export default function SendInviteButton() {
  const { submit } = useForm();
  const processing = useFormProcessing();

  return (
    <button
      type="button"
      className="btn btn--style-secondary btn--size-medium"
      disabled={processing}
      onClick={() => void submit({ overrides: { resend_invite: true } })}
    >
      招待メールを送信
    </button>
  );
}
