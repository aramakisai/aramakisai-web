'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { navigationItems } from '@/components/header';

const FOCUSABLE_SELECTOR = 'a[href]';

export function MapMenuButton() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );
    focusables[0]?.focus();

    // Leaflet 側にも独自の keydown ハンドラがあるため、地図より確実に先に処理させるには
    // document で捕捉するしかない (要件 10.3)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || focusables.length === 0) return;

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

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-6">
          <path
            d="M2 5h20M2 12h20M2 19h20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
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
                {navigationItems.map((item) => (
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
