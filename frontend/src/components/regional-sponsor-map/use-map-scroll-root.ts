'use client';

import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const ROOT_SELECTOR = '[data-map-scroll-root]';

/**
 * 一覧は PC パネルでは内側の領域、SP ではシート全体が外側でスクロールする。
 * どちらも data-map-scroll-root を持つため、そこを基準に位置を戻して通知する。
 * 戻ってきた(マウントした)ときだけ復元し、スクロールのたびに代入し直さない
 */
export function useRestoredMapScroll(
  ref: RefObject<HTMLElement | null>,
  initialScrollTop: number,
  onScrollTopChange: (scrollTop: number) => void,
) {
  useLayoutEffect(() => {
    const root = ref.current?.closest<HTMLElement>(ROOT_SELECTOR);
    if (!root) return;
    root.scrollTop = initialScrollTop;
    const handle = () => onScrollTopChange(root.scrollTop);
    root.addEventListener('scroll', handle);
    return () => root.removeEventListener('scroll', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** 一覧のスクロール位置が残ったまま詳細が開かないよう、表示対象が変わるたびに先頭へ戻す */
export function useResetMapScroll(
  ref: RefObject<HTMLElement | null>,
  key: unknown,
) {
  useLayoutEffect(() => {
    const root = ref.current?.closest<HTMLElement>(ROOT_SELECTOR);
    if (root) root.scrollTop = 0;
  }, [ref, key]);
}
