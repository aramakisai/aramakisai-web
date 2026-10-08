'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  readonly selectedAreaId?: number | null;
  /** シートの実高さ (px) が変わるたびに呼ばれる。地図側コントロールの余白追従に使う */
  readonly onHeightChange?: (height: number) => void;
}

// 0: グラバーだけが見える最小高さ (リスト状態に関わらず到達可能)
// 1: 内容の高さに合わせて縮んだ状態 (条件なしのときのみ到達可能)
// 2: Figma の SP「エリア選択時」「検索結果」フレームが指定する 380px
// 3: 従来の展開時の値 55vh
// 4: 全画面 (上端は safe-area を避ける)
type SnapIndex = 0 | 1 | 2 | 3 | 4;

// p-4 の上余白 + グラバー行 (py-2 + h-1) + 下に少し余白
const MIN_SNAP_PX = 44;
const MID_SNAP_PX = 380;
const MAX_SNAP_VH = 55;
const SNAP_LABELS: Record<SnapIndex, string> = {
  0: '最小',
  1: '折りたたみ',
  2: '標準',
  3: '大',
  4: '全画面',
};
// 高さの遷移を成立させるため、スナップ先は常に数値を含む長さで持つ ('auto' のみ例外)
const SNAP_HEIGHTS: Record<SnapIndex, string> = {
  0: `${MIN_SNAP_PX}px`,
  1: 'auto',
  2: `${MID_SNAP_PX}px`,
  3: `${MAX_SNAP_VH}vh`,
  4: 'calc(100dvh - env(safe-area-inset-top))',
};
// 離す直前にこの速さ (px/ms) 以上で動いていたらフリックとして扱う
const FLICK_VELOCITY = 0.5;
const FLICK_WINDOW_MS = 100;
// これ未満の移動はドラッグと見なさず、リスト内のタップ/クリックをそのまま通す
const DRAG_THRESHOLD_PX = 6;

function largeSnapPx(): number {
  return (window.innerHeight * MAX_SNAP_VH) / 100;
}
function fullSnapPx(): number {
  return window.innerHeight;
}

export function MapBottomSheet({
  state,
  notice,
  selectedAreaId = null,
  onHeightChange,
}: MapBottomSheetProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  // 独立した開閉状態は持たず、リストの表示状態からそのまま導く (design.md 参照)。
  // 実コンテンツを持つのは filtered のみで、それ以外 (unselected/no-area/error) は
  // 常に 1 行の案内だけなので折りたたんでよい
  const collapsed = state.kind !== 'filtered';
  // 企画リストを内容の高さまで縮めると意味のある「折りたたみ」にならないため、
  // 内容高 (1) へのスナップは条件なし (collapsed) のときだけ許す
  const restSnap: SnapIndex = collapsed ? 1 : 2;
  const snaps: readonly SnapIndex[] = collapsed
    ? [0, 1, 2, 3, 4]
    : [0, 2, 3, 4];

  const [snapIndex, setSnapIndex] = useState<SnapIndex>(restSnap);
  const prevCollapsedRef = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsedRef.current !== collapsed) {
      prevCollapsedRef.current = collapsed;
      setSnapIndex(collapsed ? 1 : 2);
    }
  }, [collapsed]);

  // 最小まで縮めたまま別エリアを選ぶと、結果が見えないままになるため引き上げる。
  // 標準以上なら利用者が選んだ高さを尊重し、選択解除でも動かさない
  useEffect(() => {
    if (selectedAreaId !== null) {
      setSnapIndex((current) => (current < 2 ? 2 : current));
    }
  }, [selectedAreaId]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const grabberRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  // 全画面以外のスナップでは検索欄 (z-[1080]) より背面だが、ドラッグ中とスナップへの
  // 遷移中はシートが検索欄の位置まで伸びうるため、その間だけ全画面と同じ前面に出す。
  // 全画面で外す角丸も、全画面から離れつつある間は付けておく
  const [elevated, setElevated] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startHeight: number;
    startScrollTop: number;
    scrollable: boolean;
    // グラバー起点は常にドラッグ。それ以外はリストのスクロールと取り合う
    fromGrabber: boolean;
    claimed: boolean;
    cancelled: boolean;
    samples: { t: number; y: number }[];
  } | null>(null);

  // 上方向は全画面未満なら広げ、下方向はリストが先頭のときだけ縮める。
  // それ以外はリスト本来のスクロールに任せる
  const ownsVerticalMove = (
    drag: NonNullable<typeof dragRef.current>,
    draggedUpBy: number,
  ) =>
    drag.fromGrabber ||
    !drag.scrollable ||
    (draggedUpBy > 0
      ? drag.startHeight < fullSnapPx() - 1
      : draggedUpBy < 0 && drag.startScrollTop <= 0);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !onHeightChange || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      // contentRect は padding を含まないため、getBoundingClientRect (border-box) と
      // 初回呼び出し (下の el.getBoundingClientRect() 呼び出し) の基準を揃える
      const target = entries[0]?.target;
      if (target instanceof HTMLElement) {
        onHeightChange(target.getBoundingClientRect().height);
      }
    });
    observer.observe(el);
    onHeightChange(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [onHeightChange]);

  // iOS Safari は最初の touchmove でスクロールかどうかを決めるため、React の
  // (passive な) ハンドラではなく非 passive のネイティブリスナーで打ち消す必要がある
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onTouchMove = (event: TouchEvent) => {
      const drag = dragRef.current;
      const touch = event.touches[0];
      if (!drag || drag.cancelled || !touch || !event.cancelable) return;
      const dx = touch.clientX - drag.startX;
      const draggedUpBy = drag.startY - touch.clientY;
      if (
        drag.claimed ||
        (Math.abs(draggedUpBy) > Math.abs(dx) &&
          ownsVerticalMove(drag, draggedUpBy))
      ) {
        event.preventDefault();
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = sheetRef.current;
    if (!el || event.button > 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startHeight: el.getBoundingClientRect().height,
      startScrollTop: el.scrollTop,
      scrollable: el.scrollHeight > el.clientHeight + 1,
      fromGrabber: !!grabberRef.current?.contains(event.target as Node),
      claimed: false,
      cancelled: false,
      samples: [{ t: performance.now(), y: event.clientY }],
    };
    // マウスはシートが小さいとポインタがすぐシート外へ出て、シート上のハンドラでは
    // 以降の move/up を受け取れない。capture は確定後にしか取らないため window で受ける
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerMove = (event: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    const el = sheetRef.current;
    if (!drag || !el || drag.cancelled) return;
    if (!drag.claimed) {
      const dx = event.clientX - drag.startX;
      const draggedUpBy = drag.startY - event.clientY;
      if (Math.hypot(dx, draggedUpBy) < DRAG_THRESHOLD_PX) return;
      // 横方向優位の移動は内部の横スクロール等に任せる
      if (
        Math.abs(dx) > Math.abs(draggedUpBy) ||
        !ownsVerticalMove(drag, draggedUpBy)
      ) {
        drag.cancelled = true;
        return;
      }
      drag.claimed = true;
      // 閾値分の飛びを避けるため、確定地点を基準にし直す
      drag.startY = event.clientY;
      drag.samples = [{ t: performance.now(), y: event.clientY }];
      // ドラッグ中は指に追従させるため遷移を切る。capture は確定後にだけ取る
      // (最初から取ると配下のリンクへの click が届かなくなる)
      el.style.transition = 'none';
      setElevated(true);
      el.setPointerCapture?.(event.pointerId);
    }
    const draggedUpBy = drag.startY - event.clientY;
    const next = Math.min(
      fullSnapPx(),
      Math.max(MIN_SNAP_PX, drag.startHeight + draggedUpBy),
    );
    el.style.height = `${next}px`;
    drag.samples.push({ t: performance.now(), y: event.clientY });
  };

  const handlePointerUp = (event: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    const el = sheetRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    if (!drag || !el || !drag.claimed) return;
    // 確定したドラッグの末尾で発火する click (リンク等) を打ち消す。click が
    // 来ない場合に次の操作を巻き込まないよう、イベントループ一周で解除する
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    el.releasePointerCapture?.(event.pointerId);
    const currentPx = el.getBoundingClientRect().height;

    // scrollHeight は現在の高さが内容より高いと内容高を返さないため、子の実寸から求める
    const style = getComputedStyle(el);
    const grabber = grabberRef.current;
    const fitPx =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0) +
      (grabber
        ? grabber.offsetHeight +
          (parseFloat(getComputedStyle(grabber).marginBottom) || 0)
        : 0) +
      (listRef.current?.offsetHeight ?? 0);

    const candidates: ReadonlyArray<readonly [SnapIndex, number]> = [
      [0, MIN_SNAP_PX],
      ...(collapsed ? [[1, fitPx] as const] : []),
      [2, MID_SNAP_PX],
      [3, largeSnapPx()],
      [4, fullSnapPx()],
    ];
    const now = performance.now();
    const recent = drag.samples.filter((p) => now - p.t <= FLICK_WINDOW_MS);
    const first = recent[0];
    const last = drag.samples[drag.samples.length - 1];
    const velocity =
      first && last && last.t > first.t
        ? (first.y - last.y) / (last.t - first.t) // 正: 上方向
        : 0;

    let target: SnapIndex | null = null;
    if (Math.abs(velocity) >= FLICK_VELOCITY) {
      const ahead = candidates
        .filter(([, px]) =>
          velocity > 0 ? px > currentPx + 1 : px < currentPx - 1,
        )
        .sort((a, b) => (velocity > 0 ? a[1] - b[1] : b[1] - a[1]));
      target = ahead[0]?.[0] ?? null;
    }
    if (target === null) {
      let nearestDistance = Infinity;
      target = restSnap;
      for (const [index, px] of candidates) {
        const distance = Math.abs(currentPx - px);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = index;
        }
      }
    }

    // 遷移を戻した後に reflow を挟んでからスナップ先を与えないと、ドラッグ位置からの
    // アニメーションにならず即座にジャンプする
    el.style.transition = '';
    void el.offsetHeight;
    el.style.height = SNAP_HEIGHTS[target];
    setSnapIndex(target);
    // duration-300 の遷移が終わるまで前面を保つ
    setTimeout(() => setElevated(false), 300);
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSnapIndex((current) => snaps.find((s) => s > current) ?? current);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSnapIndex(
        (current) => [...snaps].reverse().find((s) => s < current) ?? current,
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSnapIndex((current) =>
        current === restSnap
          ? (snaps.find((s) => s > restSnap) ?? current)
          : restSnap,
      );
    }
  };

  return (
    // 高さが内容に応じて縮む (collapsed) 場合でも上限一杯 (expanded) の場合でも、
    // この外枠自体は下端に貼り付くだけで余白を持たないため地図を覆わない。
    // pointer-events-none はそれでも確実にするための保険
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 flex justify-center md:hidden ${snapIndex === 4 || elevated ? 'z-[1100]' : 'z-[1050]'}`}
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      <div
        ref={sheetRef}
        data-testid="map-bottom-sheet"
        // interpolate-size は 'auto' への/からの高さ遷移を許す (非対応ブラウザでは即時切替)
        className={`pointer-events-auto w-full select-none max-w-2xl bg-white p-4 shadow-xl transition-[height] duration-300 ease-out [interpolate-size:allow-keywords] ${snapIndex === 4 && !elevated ? '' : 'rounded-t-2xl'} ${snapIndex <= 1 ? 'overflow-hidden' : 'overflow-y-auto'}`}
        style={{ height: SNAP_HEIGHTS[snapIndex] }}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        // リンクや画像のネイティブドラッグが始まると pointercancel でシートのドラッグが途切れる
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          ref={grabberRef}
          role="button"
          tabIndex={0}
          aria-expanded={snapIndex !== restSnap}
          aria-label={`シートの高さを変更 (現在: ${SNAP_LABELS[snapIndex]})`}
          className="mb-3 flex touch-none cursor-grab items-center justify-center py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:cursor-grabbing"
          onKeyDown={handleKeyDown}
        >
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-gray-300"
          />
        </div>
        {/* 最小時は内容が隠れるだけなので、フォーカスも届かないようにする */}
        <div ref={listRef} inert={snapIndex === 0}>
          <AreaExhibitionList state={state} notice={notice} />
        </div>
      </div>
    </div>
  );
}
