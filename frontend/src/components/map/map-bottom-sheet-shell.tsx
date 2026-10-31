'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

export interface MapBottomSheetSnapContext {
  readonly viewportHeight: number;
  readonly contentHeight: number;
  readonly bottomInset: number;
}

export interface MapBottomSheetSnap {
  readonly id: string;
  readonly label: string;
  readonly height: string;
  readonly resolveHeightPx: (context: MapBottomSheetSnapContext) => number;
  readonly overflow: 'hidden' | 'auto';
  readonly contentInert?: boolean;
  readonly fullScreen?: boolean;
}

export interface MapBottomSheetShellProps {
  readonly children: ReactNode;
  readonly snaps: readonly MapBottomSheetSnap[];
  readonly snapId: string;
  readonly restSnapId: string;
  readonly onSnapChange: (snapId: string) => void;
  /**
   * 現在の snap が transition で行き着く高さ。transition 中の実高さを地図の余白に流すと
   * 地図が毎フレーム伸縮してズームが往復するため、移動先の高さだけを通知する。
   * シートが非表示 (PC 幅) のときは 0
   */
  readonly onTargetHeightChange?: (height: number) => void;
  /** onTargetHeightChange と同じ高さを、伸びる向きの遅延なしで即時に通知する */
  readonly onTargetHeightIntent?: (height: number) => void;
  readonly contentClassName?: string;
  readonly outerClassName?: string;
  readonly sheetShadowClassName?: string;
  /** シートの内側余白。つまみの位置を変える画面は上余白を0にして grabberClassName 側で置く */
  readonly sheetPaddingClassName?: string;
  readonly grabberClassName?: string;
}

const FLICK_VELOCITY = 0.5;
const FLICK_WINDOW_MS = 100;
const DRAG_THRESHOLD_PX = 6;

export function MapBottomSheetShell({
  children,
  snaps,
  snapId,
  restSnapId,
  onSnapChange,
  onTargetHeightChange,
  onTargetHeightIntent,
  contentClassName,
  outerClassName,
  sheetShadowClassName = 'shadow-xl',
  sheetPaddingClassName = 'p-4',
  grabberClassName = 'mb-3 py-2',
}: MapBottomSheetShellProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  const currentSnap =
    snaps.find((snap) => snap.id === snapId) ??
    snaps.find((snap) => snap.id === restSnapId) ??
    snaps[0];
  const restSnap = snaps.find((snap) => snap.id === restSnapId) ?? currentSnap;

  if (!currentSnap || !restSnap) {
    throw new Error('MapBottomSheetShell には1件以上のsnapが必要です');
  }

  const outerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const grabberRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const [elevated, setElevated] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startHeight: number;
    startScrollTop: number;
    scrollable: boolean;
    fromGrabber: boolean;
    claimed: boolean;
    cancelled: boolean;
    samples: { t: number; y: number }[];
  } | null>(null);

  const measureSnapContext = (): MapBottomSheetSnapContext => {
    const el = sheetRef.current;
    const bottomInset = outerRef.current
      ? parseFloat(getComputedStyle(outerRef.current).bottom) || 0
      : 0;
    if (!el) {
      return {
        viewportHeight: window.innerHeight,
        contentHeight: 0,
        bottomInset,
      };
    }
    // scrollHeight は現在の高さが内容より高いと内容高を返さないため、子の実寸から求める
    const style = getComputedStyle(el);
    const grabber = grabberRef.current;
    const contentHeight =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0) +
      (grabber
        ? grabber.offsetHeight +
          (parseFloat(getComputedStyle(grabber).marginTop) || 0) +
          (parseFloat(getComputedStyle(grabber).marginBottom) || 0)
        : 0) +
      (contentRef.current?.offsetHeight ?? 0);
    return { viewportHeight: window.innerHeight, contentHeight, bottomInset };
  };

  const maxSnapPx = () => {
    const context = measureSnapContext();
    return Math.max(...snaps.map((snap) => snap.resolveHeightPx(context)));
  };

  const ownsVerticalMove = (
    drag: NonNullable<typeof dragRef.current>,
    draggedUpBy: number,
  ) =>
    drag.fromGrabber ||
    !drag.scrollable ||
    (draggedUpBy > 0
      ? drag.startHeight < maxSnapPx() - 1
      : draggedUpBy < 0 && drag.startScrollTop <= 0);

  // height:auto からの transition は、同じ commit で入れ替わった内容の高さ (絞り込み直後は
  // 一覧全体) を起点に始まってしまう。内容が替わる前の実高さを起点に固定し直す
  const prevSnapRef = useRef(currentSnap);
  const lastHeightRef = useRef<number | null>(null);
  // ドラッグ解放は handlePointerUp が高さを直接決める。その分は固定し直さない
  const releasedDragRef = useRef(false);
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const prev = prevSnapRef.current;
    prevSnapRef.current = currentSnap;
    const from = lastHeightRef.current;
    const released = releasedDragRef.current;
    releasedDragRef.current = false;
    if (
      prev !== currentSnap &&
      prev.height === 'auto' &&
      from !== null &&
      !released
    ) {
      el.style.transition = 'none';
      el.style.height = `${from}px`;
      void el.offsetHeight;
      el.style.transition = '';
      el.style.height = currentSnap.height;
    }
    // 起点が要るのは fit (auto) から出るときだけ。他の段では実寸を読まない
    lastHeightRef.current =
      currentSnap.height === 'auto' ? el.getBoundingClientRect().height : null;
  });

  // 地図は通知された高さの分だけ縮む。伸びる向きでは、transition の途中で地図だけが先に縮むと
  // シートとの間が空くため、height の transition が終わってから通知する。縮む向きは即時
  const notifiedHeightRef = useRef<number | null>(null);
  const pendingRef = useRef<{ height: number; cancel: () => void } | null>(
    null,
  );
  useLayoutEffect(() => {
    const el = sheetRef.current;
    const hidden =
      !!outerRef.current &&
      getComputedStyle(outerRef.current).display === 'none';
    const height = hidden
      ? 0
      : currentSnap.resolveHeightPx(measureSnapContext());
    onTargetHeightIntent?.(height);
    if (pendingRef.current && pendingRef.current.height !== height) {
      pendingRef.current.cancel();
    }
    if (pendingRef.current || height === notifiedHeightRef.current) return;
    const notify = () => {
      pendingRef.current = null;
      notifiedHeightRef.current = height;
      onTargetHeightChange?.(height);
    };
    const growing =
      notifiedHeightRef.current !== null && height > notifiedHeightRef.current;
    const transitioning =
      !!el &&
      !hidden &&
      parseFloat(getComputedStyle(el).transitionDuration) > 0 &&
      Math.abs(el.getBoundingClientRect().height - height) >= 1;
    if (!growing || !transitioning || !el) {
      notify();
      return;
    }
    const finish = (event: Event) => {
      if (
        event.target === el &&
        (event.type === 'transitioncancel' ||
          (event as TransitionEvent).propertyName === 'height')
      ) {
        cancel();
        notify();
      }
    };
    const cancel = () => {
      el.removeEventListener('transitionend', finish);
      el.removeEventListener('transitioncancel', finish);
      pendingRef.current = null;
    };
    el.addEventListener('transitionend', finish);
    el.addEventListener('transitioncancel', finish);
    pendingRef.current = { height, cancel };
  });
  useEffect(() => () => pendingRef.current?.cancel(), []);

  // SSR 後の初回描画と URL からの状態復元が済むまで transition を掛けない。
  // 掛けると復元後の高さへ SSR の高さから伸びる動きが見えてしまう
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // iOS Safari は最初の touchmove でスクロールかどうかを決めるため非 passive で処理する
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
    const nestedScrollElement =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-map-sheet-scroll]')
        : null;
    const scrollElement =
      nestedScrollElement && el.contains(nestedScrollElement)
        ? nestedScrollElement
        : el;
    suppressClickRef.current = false;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startHeight: el.getBoundingClientRect().height,
      startScrollTop: scrollElement.scrollTop,
      scrollable: scrollElement.scrollHeight > scrollElement.clientHeight + 1,
      fromGrabber: !!grabberRef.current?.contains(event.target as Node),
      claimed: false,
      cancelled: false,
      samples: [{ t: performance.now(), y: event.clientY }],
    };
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
      if (
        Math.abs(dx) > Math.abs(draggedUpBy) ||
        !ownsVerticalMove(drag, draggedUpBy)
      ) {
        drag.cancelled = true;
        return;
      }
      drag.claimed = true;
      drag.startY = event.clientY;
      drag.samples = [{ t: performance.now(), y: event.clientY }];
      el.style.transition = 'none';
      setElevated(true);
      el.setPointerCapture?.(event.pointerId);
    }
    const context = measureSnapContext();
    const snapHeights = snaps.map((snap) => snap.resolveHeightPx(context));
    const draggedUpBy = drag.startY - event.clientY;
    const next = Math.min(
      Math.max(...snapHeights),
      Math.max(Math.min(...snapHeights), drag.startHeight + draggedUpBy),
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
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    el.releasePointerCapture?.(event.pointerId);
    const currentPx = el.getBoundingClientRect().height;
    const context = measureSnapContext();
    const candidates = snaps.map(
      (snap) => [snap, snap.resolveHeightPx(context)] as const,
    );
    const now = performance.now();
    const recent = drag.samples.filter(
      (point) => now - point.t <= FLICK_WINDOW_MS,
    );
    const first = recent[0];
    const last = drag.samples[drag.samples.length - 1];
    const velocity =
      first && last && last.t > first.t
        ? (first.y - last.y) / (last.t - first.t)
        : 0;

    let target: MapBottomSheetSnap | undefined;
    if (Math.abs(velocity) >= FLICK_VELOCITY) {
      target = candidates
        .filter(([, px]) =>
          velocity > 0 ? px > currentPx + 1 : px < currentPx - 1,
        )
        .sort((a, b) => (velocity > 0 ? a[1] - b[1] : b[1] - a[1]))[0]?.[0];
    }
    if (!target) {
      let nearestDistance = Infinity;
      target = restSnap;
      for (const [snap, px] of candidates) {
        const distance = Math.abs(currentPx - px);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = snap;
        }
      }
    }

    el.style.transition = '';
    void el.offsetHeight;
    el.style.height = target.height;
    releasedDragRef.current = true;
    onSnapChange(target.id);
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
    const currentIndex = Math.max(
      0,
      snaps.findIndex((snap) => snap.id === currentSnap.id),
    );
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onSnapChange(snaps[currentIndex + 1]?.id ?? currentSnap.id);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onSnapChange(snaps[currentIndex - 1]?.id ?? currentSnap.id);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSnapChange(
        currentSnap.id === restSnap.id
          ? (snaps[currentIndex + 1]?.id ?? currentSnap.id)
          : restSnap.id,
      );
    }
  };

  return (
    <div
      ref={outerRef}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--map-nav,0px)] flex justify-center lg:hidden ${currentSnap.fullScreen || elevated ? 'z-[1100]' : 'z-[1050]'} ${outerClassName ?? ''}`}
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      {/* 下に落ちる影が下部ナビの上に描かれるのを防ぐため、下端より下だけ切り落とす */}
      <div
        ref={sheetRef}
        data-testid="map-bottom-sheet"
        data-map-scroll-root
        className={`pointer-events-auto w-full select-none bg-white [clip-path:inset(-40px_-40px_0_-40px)] ${sheetPaddingClassName} ${sheetShadowClassName} ${animated ? 'transition-[height] duration-300 ease-out motion-reduce:transition-none' : ''} [interpolate-size:allow-keywords] ${currentSnap.fullScreen && !elevated ? '' : 'rounded-t-2xl'} ${currentSnap.overflow === 'auto' ? 'overflow-y-auto' : 'overflow-hidden'}`}
        style={{ height: currentSnap.height }}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          ref={grabberRef}
          role="button"
          tabIndex={0}
          aria-expanded={currentSnap.id !== restSnap.id}
          aria-label={`シートの高さを変更 (現在: ${currentSnap.label})`}
          className={`${grabberClassName} flex touch-none cursor-grab items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:cursor-grabbing`}
          onKeyDown={handleKeyDown}
        >
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-gray-300"
          />
        </div>
        <div
          ref={contentRef}
          inert={currentSnap.contentInert}
          className={contentClassName}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
