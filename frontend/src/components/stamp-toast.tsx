'use client';

import { useEffect, useState } from 'react';
import { TextLink } from './text-link';

export type StampToastKind = 'added' | 'exists' | 'bookmarked';

const MESSAGES: Readonly<Record<StampToastKind, string>> = {
  added: 'スタンプを取得しました',
  exists: '取得済みのスタンプです',
  bookmarked: 'ブックマークしました',
};

const LINK_HREFS: Readonly<Record<StampToastKind, string>> = {
  added: '/mypage',
  exists: '/mypage',
  bookmarked: '/mypage#bookmarks',
};

const DISPLAY_MS = 3000;
// 出入りの transition (duration-200) と揃える。ずれると退場が途中で切れる
const TRANSITION_MS = 200;

type ToastState = 'entering' | 'open' | 'leaving' | 'gone';

export function StampToast({
  kind,
  message,
  showLink = true,
}: {
  readonly kind: StampToastKind;
  readonly message?: string;
  readonly showLink?: boolean;
}) {
  const [state, setState] = useState<ToastState>('entering');

  useEffect(() => {
    // 初期描画を透明のまま確定させてから遷移させないと、入場 transition が走らない
    const enter = setTimeout(() => setState('open'), 20);
    const leave = setTimeout(() => setState('leaving'), DISPLAY_MS);
    const remove = setTimeout(
      () => setState('gone'),
      DISPLAY_MS + TRANSITION_MS,
    );
    return () => {
      clearTimeout(enter);
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, []);

  if (state === 'gone') return null;

  return (
    <div
      role="status"
      data-state={state}
      // 下部ナビ (h-16) がある幅ではその上 16px。ナビ側が足すセーフエリアぶんもここで足す。
      // lg 以上は下部ナビが消えるため画面下端から 16px
      className={`fixed right-4 bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))] z-40 flex min-h-12 w-[358px] max-w-[calc(100vw-2rem)] items-center justify-between gap-4 rounded-lg bg-gray-800 px-4 py-3 shadow-card transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none lg:bottom-[calc(1rem+env(safe-area-inset-bottom))] ${
        state === 'open'
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0 motion-reduce:translate-y-0'
      }`}
    >
      <span className="text-sm leading-[1.6] text-background">
        {message ?? MESSAGES[kind]}
      </span>
      {showLink && (
        <TextLink href={LINK_HREFS[kind]} tone="inverse">
          マイページ
        </TextLink>
      )}
    </div>
  );
}
