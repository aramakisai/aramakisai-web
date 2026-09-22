'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { navigationItems } from '@/components/header';
import { visibleNavItems, type FestivalPhase } from '@/lib/phase';
import { MenuIcon } from '@/components/icons';
import { useFocusTrap } from '@/lib/use-focus-trap';

export interface MapMenuButtonProps {
  readonly phase: FestivalPhase;
}

export function MapMenuButton({ phase }: MapMenuButtonProps) {
  const items = visibleNavItems(navigationItems, phase);
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
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={() => setIsOpen(true)}
        className="map-menu-button-position fixed right-[max(1rem,env(safe-area-inset-right))] z-[1100] flex h-[var(--map-toolbar-size)] w-[var(--map-toolbar-size)] items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        <span className="sr-only">メニューを開く</span>
        <MenuIcon size={24} />
      </button>

      {isOpen && (
        // z-index は Leaflet のコントロール (最大 1000) より確実に上に出す必要がある
        <div
          data-testid="map-menu-overlay"
          className="fixed inset-0 z-[1090]"
          onClick={close}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label="サイト内メニュー"
            onClick={(event) => event.stopPropagation()}
            className="absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] right-[max(1rem,env(safe-area-inset-right))] w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2 shadow-xl"
          >
            <nav aria-label="サイト内ナビゲーション">
              <ul>
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="block rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100"
                    >
                      {item.label}
                    </Link>
                    {item.children && (
                      <ul className="pl-3">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={close}
                              className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
