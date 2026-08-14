'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavigationItem = {
  label: string;
  href: string;
  children?: readonly {
    label: string;
    href: string;
  }[];
};

// 企画一覧・会場案内・協賛企業は対応ページが未実装のため一時的に非表示。
// ページ実装後は navigationItems へ戻す (要件 5.2)。
export const navigationItems: readonly NavigationItem[] = [
  { label: 'TOP', href: '/' },
  {
    label: '荒牧祭について',
    href: '/#about',
    children: [
      { label: '概要', href: '/#about-overview' },
      { label: '開催スケジュール', href: '/#about-schedule' },
      { label: '今年のテーマ', href: '/#about-theme' },
    ],
  },
  { label: 'お知らせ', href: '/announcements' },
  { label: 'アクセス', href: '/access' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileAboutOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((isOpen) => {
      if (isOpen) {
        setMobileAboutOpen(false);
      }
      return !isOpen;
    });
  };

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setMobileAboutOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/75 pt-[env(safe-area-inset-top)] shadow-[0_1px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-16 w-full items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:h-20 lg:pl-6 lg:pr-6 xl:pl-8 xl:pr-8">
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
          >
            <img
              src="/images/logo-2026.png"
              alt="荒牧祭2026"
              className="h-8 w-auto lg:h-9 xl:h-10"
            />
          </Link>

          <nav aria-label="メインナビゲーション" className="hidden lg:block">
            <ul className="flex items-center gap-1 xl:gap-2">
              {navigationItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <li
                    key={item.href}
                    className={
                      item.children ? 'group/about relative' : undefined
                    }
                  >
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative block whitespace-nowrap rounded-full px-3 py-2 text-base font-medium tracking-wide transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                        isActive
                          ? 'bg-white/70 text-slate-950'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={`mansai-spectrum-line absolute inset-x-3 bottom-0 h-px origin-center transition-all duration-200 ${
                          isActive
                            ? 'scale-x-100 opacity-100'
                            : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-80 group-focus-visible:scale-x-100 group-focus-visible:opacity-80 group-hover/about:scale-x-100 group-hover/about:opacity-80 group-focus-within/about:scale-x-100 group-focus-within/about:opacity-80'
                        }`}
                      />
                    </Link>

                    {item.children && (
                      <div className="pointer-events-none absolute top-full left-1/2 z-20 w-56 -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-[opacity,transform] duration-200 group-hover/about:pointer-events-auto group-hover/about:translate-y-0 group-hover/about:opacity-100 group-focus-within/about:pointer-events-auto group-focus-within/about:translate-y-0 group-focus-within/about:opacity-100 motion-reduce:transition-none">
                        <ul
                          aria-label="荒牧祭についてのサブメニュー"
                          className="overflow-hidden border border-white/70 bg-white/90 px-2 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75"
                        >
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className="group/sub relative block whitespace-nowrap px-4 py-3 text-sm font-medium tracking-wide text-slate-700 transition-colors duration-200 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600"
                              >
                                {child.label}
                                <span
                                  aria-hidden="true"
                                  className="mansai-spectrum-line absolute inset-x-4 bottom-2 h-px origin-left scale-x-0 opacity-0 transition-all duration-200 group-hover/sub:scale-x-100 group-hover/sub:opacity-80 group-focus-visible/sub:scale-x-100 group-focus-visible/sub:opacity-80 motion-reduce:transition-none"
                                />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            ref={mobileMenuButtonRef}
            type="button"
            aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={toggleMobileMenu}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 lg:hidden"
          >
            <span aria-hidden="true" className="relative block h-5 w-6">
              <span
                className={`absolute left-0 h-0.5 w-6 rounded-full bg-current transition-[top,transform] duration-200 motion-reduce:transition-none ${
                  mobileMenuOpen ? 'top-[9px] rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute top-[9px] left-0 h-0.5 w-6 rounded-full bg-current transition-opacity duration-200 motion-reduce:transition-none ${
                  mobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute left-0 h-0.5 w-6 rounded-full bg-current transition-[top,transform] duration-200 motion-reduce:transition-none ${
                  mobileMenuOpen ? 'top-[9px] -rotate-45' : 'top-[18px]'
                }`}
              />
            </span>
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="モバイルナビゲーション"
            className="absolute inset-x-0 top-full max-h-[calc(100svh_-_4rem_-_env(safe-area-inset-top))] w-full min-w-0 overflow-y-auto border-b border-slate-200/80 bg-white/95 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_18px_36px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 lg:hidden"
          >
            <ul className="px-5 py-3 sm:px-6">
              {navigationItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <li
                    key={item.href}
                    className="border-b border-slate-200/70 last:border-b-0"
                  >
                    {item.children ? (
                      <>
                        <div className="flex min-w-0 items-center">
                          <Link
                            href={item.href}
                            onClick={closeMobileMenu}
                            className={`flex min-h-11 min-w-0 flex-1 items-center py-3 text-base font-medium tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 ${
                              isActive ? 'text-slate-950' : 'text-slate-700'
                            }`}
                          >
                            {item.label}
                          </Link>
                          <button
                            type="button"
                            aria-label={`荒牧祭についてのサブメニューを${
                              mobileAboutOpen ? '閉じる' : '開く'
                            }`}
                            aria-expanded={mobileAboutOpen}
                            aria-controls="mobile-about-submenu"
                            onClick={() =>
                              setMobileAboutOpen((isOpen) => !isOpen)
                            }
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className={`h-5 w-5 transition-transform duration-200 motion-reduce:transition-none ${
                                mobileAboutOpen ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                            >
                              <path
                                d="m7 9.5 5 5 5-5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>

                        {mobileAboutOpen && (
                          <ul
                            id="mobile-about-submenu"
                            aria-label="荒牧祭についてのモバイルサブメニュー"
                            className="pb-3 pl-4"
                          >
                            {item.children.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={closeMobileMenu}
                                  className="flex min-h-11 items-center border-l border-slate-200 px-4 py-2 text-[0.9375rem] tracking-wide text-slate-600 transition-colors hover:border-sky-400 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600"
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={closeMobileMenu}
                        className={`flex min-h-11 items-center py-3 text-base font-medium tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 ${
                          isActive ? 'text-slate-950' : 'text-slate-700'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
      <div
        aria-hidden="true"
        className="header-spacer h-[calc(4rem+env(safe-area-inset-top))] lg:h-[calc(5rem+env(safe-area-inset-top))]"
      />
    </>
  );
}
