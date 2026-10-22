'use client';

import { useState } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import { useMypageData } from '@/lib/use-mypage-data';
import { ShareIcon } from './icons';

export interface ShareButtonProps {
  readonly title: string;
  /** 絶対 URL。サーバー側で組み立てて渡す */
  readonly url: string;
  /** 共有の前に同じ行で並べるアクション */
  readonly leading?: React.ReactNode;
  /** アクション行の次(PC・保存不可の1行の形では共有の右)に並べるリンク群 */
  readonly children?: React.ReactNode;
}

type Notice =
  | { readonly kind: 'idle' }
  | { readonly kind: 'copied' }
  | { readonly kind: 'copy-failed' };

const NOTICE_DURATION_MS = 3000;

export function ShareButton({
  title,
  url,
  leading,
  children,
}: ShareButtonProps) {
  // 保存できない端末ではブックマークを出さず1行の形にする。PC は CSS 側で1行にする
  const inline = useMypageData() === 'unavailable';
  const [notice, setNotice] = useState<Notice>({ kind: 'idle' });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      sendGaEvent('share', { method: 'clipboard', result: 'success' });
      setNotice({ kind: 'copied' });
      setTimeout(() => setNotice({ kind: 'idle' }), NOTICE_DURATION_MS);
    } catch {
      // 手動コピー手段を出したままにする (要件 8.4)。自動では消さない。
      sendGaEvent('share', { method: 'manual', result: 'fail' });
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
        sendGaEvent('share', { method: 'web_share', result: 'success' });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          sendGaEvent('share', { method: 'web_share', result: 'cancel' });
          return; // 取りやめはエラー扱いしない (要件 8.3)
        }
        sendGaEvent('share', { method: 'web_share', result: 'fail' });
        // それ以外の失敗はコピーへフォールバック
      }
    }

    await copyToClipboard();
  };

  return (
    <div>
      <div
        data-form={inline ? 'inline' : 'stacked'}
        className="group flex flex-col gap-3 data-[form=inline]:-ml-3 data-[form=inline]:flex-row data-[form=inline]:items-center data-[form=inline]:gap-2 lg:gap-4 pc-input:-ml-3 pc-input:flex-row pc-input:items-center pc-input:gap-2"
      >
        <div className="flex items-center">
          {leading}
          <button
            type="button"
            onClick={handleClick}
            className="flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-text group-data-[form=inline]:w-12 group-data-[form=inline]:flex-none pc-input:w-12 pc-input:flex-none"
          >
            <ShareIcon size={24} />
            <span className="font-display text-body-xs">共有</span>
          </button>
        </div>
        {children}
      </div>
      {notice.kind === 'copied' && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          URLをコピーしました
        </p>
      )}
      {notice.kind === 'copy-failed' && (
        <div role="alert" className="mt-2 text-sm">
          <p className="text-gray-600">
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
