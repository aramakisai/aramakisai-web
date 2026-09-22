'use client';

import { useEffect, useRef, type RefObject } from 'react';

const DEFAULT_FOCUSABLE_SELECTOR = 'a[href]';

export interface UseFocusTrapOptions {
  /** true の間だけ Tab の循環と Esc での復帰を有効にする */
  readonly active: boolean;
  /** フォーカス可能な要素を探す範囲 */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Esc で閉じたときにフォーカスを戻す起点 (開閉ボタンなど) */
  readonly originRef: RefObject<HTMLElement | null>;
  /** Esc が押されたときに呼ぶ状態更新。フォーカスの復帰はこのフックが行う */
  readonly onClose: () => void;
  readonly focusableSelector?: string;
}

/**
 * ハンバーガーメニューと MapMenuButton で共有するフォーカストラップ。
 * 子項目の開閉でフォーカス可能な要素が増減しても崩れないよう、Tab のたびに
 * 要素を取り直す (マウント時に一度だけ集めてキャッシュしない)。
 */
export function useFocusTrap({
  active,
  containerRef,
  originRef,
  onClose,
  focusableSelector = DEFAULT_FOCUSABLE_SELECTOR,
}: UseFocusTrapOptions): void {
  // onClose は呼び出し側で毎レンダー新しい参照になり得るため、依存配列に
  // 入れると開いている間の無関係な再レンダーのたびにリスナーが張り直され
  // 先頭要素へフォーカスが戻ってしまう。ref 経由で最新値だけ参照する。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    const queryFocusables = (): HTMLElement[] =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          focusableSelector,
        ) ?? [],
      );

    queryFocusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        originRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = queryFocusables();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Leaflet 側も document にキーボードハンドラを持つため、地図より先に
    // 処理させるには capture フェーズで登録する
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      });
  }, [active, containerRef, originRef, focusableSelector]);
}
