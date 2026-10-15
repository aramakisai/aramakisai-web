'use client';

import { useState } from 'react';
import { BookmarkIcon } from '@/components/icons';
import { StampToast } from '@/components/stamp-toast';
import { sendGaEvent } from '@/lib/analytics';
import type { ExhibitionCategory } from '@/lib/exhibitions';
import { addBookmark, removeBookmark } from '@/lib/mypage-storage';
import { useMypageData } from '@/lib/use-mypage-data';

export interface BookmarkButtonProps {
  readonly exhibitionId: number;
  readonly category: ExhibitionCategory;
  readonly displayName: string;
  readonly variant: 'detail' | 'card';
  readonly className?: string;
}

const BASE =
  'pc-input:hidden flex items-center justify-center text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const SIZE = {
  detail: 'h-12 min-w-0 flex-1 flex-col gap-0.5',
  card: 'size-12',
} as const;

export function BookmarkButton({
  exhibitionId,
  category,
  displayName,
  variant,
  className = '',
}: BookmarkButtonProps) {
  const data = useMypageData();
  // 連続追加でもトーストを毎回表示し直すため key を進める
  const [toastKey, setToastKey] = useState(0);

  if (data === 'unavailable') return null;

  const saved =
    data !== null &&
    data.lists.bookmarks.some(
      (b) => b.id === exhibitionId && b.category === category,
    );
  const classes = `${BASE} ${SIZE[variant]} ${className}`.trim();
  const content = (
    <>
      <BookmarkIcon size={24} filled={saved} className="text-secondary" />
      {variant === 'detail' && (
        <span className="font-display text-body-xs">ブックマーク</span>
      )}
    </>
  );

  if (data === null) {
    return (
      <span aria-hidden="true" className={`${classes} invisible`}>
        {content}
      </span>
    );
  }

  const params = {
    exhibition_id: exhibitionId,
    exhibition_category: category,
  };

  const toggle = () => {
    if (saved) {
      if (removeBookmark(exhibitionId, category) === 'removed') {
        sendGaEvent('bookmark_remove', params);
      }
    } else if (addBookmark(exhibitionId, category) === 'added') {
      sendGaEvent('bookmark_add', params);
      setToastKey((k) => k + 1);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={
          variant === 'card' ? `${displayName}をブックマーク` : undefined
        }
        onClick={toggle}
        className={classes}
      >
        {content}
      </button>
      {toastKey > 0 && <StampToast key={toastKey} kind="bookmarked" />}
    </>
  );
}
