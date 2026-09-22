'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { FestivalPhase } from '@/lib/phase';
import {
  navigationItemsByPhase,
  linkableChildren,
  type NavigationItem,
} from '@/lib/navigation';
import { computeDropdownOffset } from '@/lib/dropdown-position';
import { ExpandMoreIcon } from '@/components/icons';

export const MAIN_CONTENT_ID = 'main-content';

const PC_DROPDOWN_WIDTH = 224;

// secondary・info はいずれも背景色に対してコントラスト比が不足するため、
// ラベルの文字色 (color/text) は変えず下線の色だけで現在地を伝える
const UNDERLINE_COLOR_CLASS: Readonly<Record<string, string>> = {
  企画一覧: 'bg-primary',
  構内マップ: 'bg-secondary',
  タイムテーブル: 'bg-info',
  お知らせ: 'bg-warning',
  ご案内: 'bg-success',
  荒牧祭について: 'bg-accent-alt',
  協賛: 'bg-accent',
};

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.href) return isPathActive(pathname, item.href);
  return (
    item.children?.some(
      (child) => child.href !== undefined && isPathActive(pathname, child.href),
    ) ?? false
  );
}

function NavIndicator({
  colorClass,
  active,
}: {
  colorClass: string;
  active: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`h-[2px] w-full origin-center transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${colorClass} ${
        active
          ? 'scale-x-100 opacity-100'
          : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-80 group-focus-within:scale-x-100 group-focus-within:opacity-80'
      }`}
    />
  );
}

export interface HeaderProps {
  readonly phase: FestivalPhase;
}

export function Header({ phase }: HeaderProps) {
  const pathname = usePathname();
  const items = navigationItemsByPhase[phase];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenLabel, setMobileOpenLabel] = useState<string | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  // PC ドロップダウンの位置補正用。コンテンツ枠はヘッダー内側の行 (px-20 の内側) と一致するため
  // その要素の bounding rect をそのまま境界として使う
  const contentRowRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [dropdownOffsets, setDropdownOffsets] = useState<
    Readonly<Record<string, { left: number; top: number }>>
  >({});

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileOpenLabel(null);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((isOpen) => {
      if (isOpen) {
        setMobileOpenLabel(null);
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
        setMobileOpenLabel(null);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useLayoutEffect(() => {
    const recompute = () => {
      const row = contentRowRef.current;
      if (!row) return;
      const rowRect = row.getBoundingClientRect();
      // row 自体が左右 padding (コンテンツ枠の余白) を持つため、bounding rect は
      // 画面端まで含んでしまう。境界はその padding の内側 (コンテンツ枠) を使う
      const rowStyle = window.getComputedStyle(row);
      const paddingLeft = parseFloat(rowStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(rowStyle.paddingRight) || 0;
      const bounds = {
        left: rowRect.left + paddingLeft,
        width: rowRect.width - paddingLeft - paddingRight,
      };

      const next: Record<string, { left: number; top: number }> = {};
      for (const item of items) {
        if (!item.children) continue;
        const el = dropdownTriggerRefs.current[item.label];
        if (!el) continue;
        const itemRect = el.getBoundingClientRect();
        next[item.label] = {
          left: computeDropdownOffset(
            { left: itemRect.left, width: itemRect.width },
            bounds,
            PC_DROPDOWN_WIDTH,
          ),
          // li はナビ行内で縦中央寄せのため下端がヘッダー下端より上にあり、その差は
          // フォント計測に依存し固定値にできない。差分を hover 用の透明な橋渡し
          // 余白として確保し、枠の上端をヘッダー下端に揃える
          top: rowRect.bottom - itemRect.bottom,
        };
      }
      setDropdownOffsets(next);
    };

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [items]);

  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        本文へ移動
      </a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-background pt-[env(safe-area-inset-top)]">
        <div
          ref={contentRowRef}
          className="flex h-16 w-full items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:h-20 lg:px-20"
        >
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <img
              src="/images/logo-2026.png"
              alt="荒牧祭2026"
              className="h-8 w-auto lg:h-10"
            />
          </Link>

          <nav aria-label="メインナビゲーション" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {items.map((item) => {
                const active = isItemActive(item, pathname);
                const colorClass =
                  UNDERLINE_COLOR_CLASS[item.label] ?? 'bg-primary';

                if (!item.children) {
                  return (
                    <li
                      key={item.label}
                      className="group flex flex-col items-start gap-1"
                    >
                      <Link
                        href={item.href as string}
                        aria-current={active ? 'page' : undefined}
                        className="text-base leading-[1.7] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {item.label}
                      </Link>
                      <NavIndicator colorClass={colorClass} active={active} />
                    </li>
                  );
                }

                const children = linkableChildren(item);

                return (
                  <li
                    key={item.label}
                    ref={(el) => {
                      dropdownTriggerRefs.current[item.label] = el;
                    }}
                    className="group relative flex flex-col items-start gap-1"
                  >
                    <button
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      className="flex items-center gap-1 text-base leading-[1.7] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {item.label}
                      <ExpandMoreIcon size={16} />
                    </button>
                    <NavIndicator colorClass={colorClass} active={active} />

                    <div
                      style={
                        dropdownOffsets[item.label] !== undefined
                          ? {
                              left: dropdownOffsets[item.label].left,
                              paddingTop: dropdownOffsets[item.label].top,
                            }
                          : undefined
                      }
                      className="pointer-events-none absolute top-full z-20 w-56 -translate-y-1 opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
                    >
                      <ul
                        aria-label={`${item.label}のサブメニュー`}
                        className="overflow-hidden rounded-lg border border-gray-200 bg-background"
                      >
                        {children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className="block px-4 py-3 text-sm leading-[1.6] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
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
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-2 rounded-full text-text transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
          >
            <span
              aria-hidden="true"
              className={`h-[2px] w-6 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? 'translate-y-2.5 rotate-45' : ''
              }`}
            />
            <span
              aria-hidden="true"
              className={`h-[2px] w-6 bg-current transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              aria-hidden="true"
              className={`h-[2px] w-6 bg-current transition-transform duration-200 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? '-translate-y-2.5 -rotate-45' : ''
              }`}
            />
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="モバイルナビゲーション"
            className="absolute inset-x-0 top-full max-h-[calc(100svh_-_4rem_-_env(safe-area-inset-top))] w-full min-w-0 overflow-y-auto border-b border-gray-200 bg-background pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
          >
            <ul className="px-5 py-3 sm:px-6">
              {items.map((item, index) => {
                const active = isItemActive(item, pathname);
                const submenuId = `mobile-submenu-${index}`;
                const submenuOpen = mobileOpenLabel === item.label;

                return (
                  <li
                    key={item.label}
                    className="border-b border-gray-200/70 last:border-b-0"
                  >
                    {item.children ? (
                      <>
                        <div className="flex min-w-0 items-center">
                          <span
                            aria-current={active ? 'page' : undefined}
                            className="flex min-h-11 min-w-0 flex-1 items-center py-3 text-base text-text"
                          >
                            {item.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`${item.label}のサブメニューを${
                              submenuOpen ? '閉じる' : '開く'
                            }`}
                            aria-expanded={submenuOpen}
                            aria-controls={submenuId}
                            onClick={() =>
                              setMobileOpenLabel((current) =>
                                current === item.label ? null : item.label,
                              )
                            }
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                          >
                            <ExpandMoreIcon
                              size={20}
                              className={`transition-transform duration-200 motion-reduce:transition-none ${
                                submenuOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {submenuOpen && (
                          <ul
                            id={submenuId}
                            aria-label={`${item.label}のモバイルサブメニュー`}
                            className="pb-3 pl-4"
                          >
                            {linkableChildren(item).map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={closeMobileMenu}
                                  className="flex min-h-11 items-center border-l border-gray-200 px-4 py-2 text-[0.9375rem] text-text/80 transition-colors hover:border-primary hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
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
                        href={item.href as string}
                        aria-current={active ? 'page' : undefined}
                        onClick={closeMobileMenu}
                        className="flex min-h-11 items-center py-3 text-base text-text"
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
