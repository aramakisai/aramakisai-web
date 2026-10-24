'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { useIsAboveMapBreakpoint } from '../campus-map/use-is-above-map-breakpoint';

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
  readonly onHeightChange?: (height: number) => void;
  readonly contentClassName?: string;
  readonly sheetClassName?: string;
  readonly bottomClassName?: string;
  readonly outerClassName?: string;
  readonly sheetShadowClassName?: string;
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
  onHeightChange,
  contentClassName,
  sheetClassName,
  bottomClassName = 'bottom-0',
  outerClassName,
  sheetShadowClassName = 'shadow-xl',
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

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !onHeightChange || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const target = entries[0]?.target;
      if (target instanceof HTMLElement) {
        onHeightChange(target.getBoundingClientRect().height);
      }
    });
    observer.observe(el);
    onHeightChange(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [onHeightChange]);

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
      className={`pointer-events-none fixed inset-x-0 ${bottomClassName} flex justify-center md:hidden ${currentSnap.fullScreen || elevated ? 'z-[1100]' : 'z-[1050]'} ${outerClassName ?? ''}`}
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      <div
        ref={sheetRef}
        data-testid="map-bottom-sheet"
        className={`pointer-events-auto w-full max-w-2xl select-none bg-white p-4 ${sheetShadowClassName} transition-[height] duration-300 ease-out motion-reduce:transition-none [interpolate-size:allow-keywords] ${currentSnap.fullScreen && !elevated ? '' : 'rounded-t-2xl'} ${currentSnap.overflow === 'auto' ? 'overflow-y-auto' : 'overflow-hidden'} ${sheetClassName ?? ''}`}
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
          className="mb-3 flex touch-none cursor-grab items-center justify-center py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:cursor-grabbing"
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
