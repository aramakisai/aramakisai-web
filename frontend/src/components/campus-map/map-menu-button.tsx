'use client';

import { useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mobileMenuItemsFor } from '@/lib/navigation';
import type { FestivalPhase } from '@/lib/phase';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { NavigationMenuRows } from '@/components/navigation-menu-rows';

export interface MapMenuButtonProps {
  readonly phase: FestivalPhase;
}

export function MapMenuButton({ phase }: MapMenuButtonProps) {
  const pathname = usePathname();
  const items = mobileMenuItemsFor(phase);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    originRef: triggerRef,
    onClose: () => setIsOpen(false),
    // 子項目の開閉ボタンも循環対象に含める (NavigationMenuRows が描画する)
    focusableSelector: 'a[href], button',
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className="map-menu-button-position fixed right-[max(1rem,env(safe-area-inset-right))] z-[1100] flex h-[var(--map-toolbar-size)] w-[var(--map-toolbar-size)] flex-col items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-text shadow-card transition-colors duration-200 ease-out hover:bg-gray-100 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:right-[max(1.5rem,env(safe-area-inset-right))]"
      >
        <span className="sr-only">
          {isOpen ? 'メニューを閉じる' : 'メニューを開く'}
        </span>
        <span
          aria-hidden="true"
          className={`h-[2px] w-6 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${
            isOpen ? 'translate-y-2.5 rotate-45' : ''
          }`}
        />
        <span
          aria-hidden="true"
          className={`h-[2px] w-6 bg-current transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            isOpen ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          aria-hidden="true"
          className={`h-[2px] w-6 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${
            isOpen ? '-translate-y-2.5 -rotate-45' : ''
          }`}
        />
      </button>

      {/* z-index は Leaflet のコントロール (最大 1000) より確実に上に出す必要がある。
          閉時も常時描画するため、overlay が地図の操作を奪わないよう pointer-events-none にする */}
      <div
        data-testid="map-menu-overlay"
        className={`fixed inset-0 z-[1090] ${isOpen ? '' : 'pointer-events-none'}`}
        onClick={close}
      >
        <div
          ref={dialogRef}
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-label="サイト内メニュー"
          aria-hidden={!isOpen}
          inert={!isOpen ? true : undefined}
          onClick={(event) => event.stopPropagation()}
          className={`absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] right-[max(1rem,env(safe-area-inset-right))] w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2 shadow-card lg:top-[calc(5rem+env(safe-area-inset-top))] lg:right-[max(1.5rem,env(safe-area-inset-right))] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            isOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <nav aria-label="サイト内ナビゲーション">
            <NavigationMenuRows
              items={items}
              pathname={pathname}
              idPrefix="map-menu"
              onNavigate={close}
            />
          </nav>
        </div>
      </div>
    </>
  );
}
