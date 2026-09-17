'use client';

import { useState } from 'react';
import { ShareIcon } from './icons';

export interface ShareButtonProps {
  readonly title: string;
  /** 絶対 URL。サーバー側で組み立てて渡す */
  readonly url: string;
}

type Notice =
  | { readonly kind: 'idle' }
  | { readonly kind: 'copied' }
  | { readonly kind: 'copy-failed' };

const NOTICE_DURATION_MS = 3000;

export function ShareButton({ title, url }: ShareButtonProps) {
  const [notice, setNotice] = useState<Notice>({ kind: 'idle' });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'copied' });
      setTimeout(() => setNotice({ kind: 'idle' }), NOTICE_DURATION_MS);
    } catch {
      // 手動コピー手段を出したままにする (要件 8.4)。自動では消さない。
      setNotice({ kind: 'copy-failed' });
    }
  };

  const handleClick = async () => {
    const data = { title, url };
    const canUseShareSheet =
      typeof navigator.share === 'function' &&
      navigator.canShare?.(data) !== false;

    if (canUseShareSheet) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return; // 取りやめはエラー扱いしない (要件 8.3)
        }
        // それ以外の失敗はコピーへフォールバック
      }
    }

    await copyToClipboard();
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-2 text-sm leading-[140%] font-medium text-text hover:text-primary"
      >
        <ShareIcon size={20} />
        共有
      </button>
      {notice.kind === 'copied' && (
        <p role="status" className="mt-2 text-sm text-gray-500">
          URLをコピーしました
        </p>
      )}
      {notice.kind === 'copy-failed' && (
        <div role="alert" className="mt-2 text-sm">
          <p className="text-gray-500">
            コピーに失敗しました。以下のURLを手動でコピーしてください
          </p>
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-text"
          />
        </div>
      )}
    </div>
  );
}
