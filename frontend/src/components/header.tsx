'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { FestivalPhase } from '@/lib/phase';
import {
  navigationItemsByPhase,
  linkableChildren,
  isItemActive,
  underlineColorClassFor,
} from '@/lib/navigation';
import { computeDropdownOffset } from '@/lib/dropdown-position';
import { ExpandMoreIcon } from '@/components/icons';
import { useFocusTrap } from '@/lib/use-focus-trap';
import {
  NavIndicator,
  NavigationMenuRows,
} from '@/components/navigation-menu-rows';

export const MAIN_CONTENT_ID = 'main-content';

const PC_DROPDOWN_WIDTH = 224;

export interface HeaderProps {
  readonly phase: FestivalPhase;
}

export function Header({ phase }: HeaderProps) {
  const pathname = usePathname();
  const items = navigationItemsByPhase[phase];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  // PC ドロップダウンの位置補正用。コンテンツ枠はヘッダー内側の行 (px-20 の内側) と一致するため
  // その要素の bounding rect をそのまま境界として使う
  const contentRowRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [dropdownOffsets, setDropdownOffsets] = useState<
    Readonly<Record<string, { left: number; top: number }>>
  >({});

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((isOpen) => !isOpen);
  };

  useFocusTrap({
    active: mobileMenuOpen,
    containerRef: mobileNavRef,
    originRef: mobileMenuButtonRef,
    onClose: closeMobileMenu,
    focusableSelector: 'a[href], button',
  });

  // 開いている間は背面のスクロールを止め、ヘッダーの外側 (本文・フッター・下部
  // ナビゲーション) を inert にして支援技術の読み上げ・キーボード操作の対象から除外する
  // (要件 7.14)。開閉ボタンはヘッダー要素の内側にあるため、document.body の直下を
  // 走査して headerRef (ヘッダー要素自身) だけを除けば両方とも対象外にできる。
  // `.inert` プロパティではなく属性を直接操作するのは、jsdom がプロパティ側の反映を
  // 実装しておらずテストで検証できないため
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const outsideElements = Array.from(document.body.children).filter(
      (el) => el !== headerRef.current,
    );
    for (const el of outsideElements) {
      el.setAttribute('inert', '');
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const el of outsideElements) {
        el.removeAttribute('inert');
      }
    };
  }, [mobileMenuOpen]);

  // 外側 (メニュー・開閉ボタン以外) の選択で閉じる (要件 7.15)
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        mobileNavRef.current?.contains(target) ||
        mobileMenuButtonRef.current?.contains(target)
      ) {
        return;
      }
      closeMobileMenu();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
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
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-background pt-[env(safe-area-inset-top)]"
      >
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          本文へ移動
        </a>
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
                const colorClass = underlineColorClassFor(item.label);

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

        <nav
          ref={mobileNavRef}
          id="mobile-navigation"
          aria-label="モバイルナビゲーション"
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen ? true : undefined}
          className={`absolute inset-x-0 top-full z-40 max-h-[calc(100svh_-_4rem_-_env(safe-area-inset-top))] w-full min-w-0 overflow-y-auto border-b border-gray-200 bg-background pb-[env(safe-area-inset-bottom)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none lg:hidden ${
            mobileMenuOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <NavigationMenuRows
            items={items}
            pathname={pathname}
            idPrefix="mobile"
            onNavigate={closeMobileMenu}
          />
        </nav>
      </header>
      <div
        aria-hidden="true"
        className="header-spacer h-[calc(4rem+env(safe-area-inset-top))] lg:h-[calc(5rem+env(safe-area-inset-top))]"
      />
    </>
  );
}
