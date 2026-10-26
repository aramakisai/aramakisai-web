'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  linkableChildren,
  isItemActive,
  underlineColorClassFor,
  type NavigationItem,
} from '@/lib/navigation';
import { ExpandMoreIcon } from '@/components/icons';

// ヘッダー行の `group` と、メニュー・ドロップダウンの子リンクの `group/sub` は祖先に重なるため、
// 子リンク側は名前付きにして親項目のホバーで点灯しないようにする
export function NavIndicator({
  colorClass,
  active,
  sub = false,
  className = '',
}: {
  readonly colorClass: string;
  readonly active: boolean;
  readonly sub?: boolean;
  readonly className?: string;
}) {
  const hover = sub
    ? 'group-hover/sub:scale-x-100 group-hover/sub:opacity-80 group-focus-visible/sub:scale-x-100 group-focus-visible/sub:opacity-80'
    : 'group-hover:scale-x-100 group-hover:opacity-80 group-focus-within:scale-x-100 group-focus-within:opacity-80';
  return (
    <span
      aria-hidden="true"
      className={`h-[2px] w-full origin-left transition-[scale,opacity] duration-200 ease-out motion-reduce:transition-none ${colorClass} ${className} ${
        active ? 'scale-x-100 opacity-100' : `scale-x-0 opacity-0 ${hover}`
      }`}
    />
  );
}

/** 現在地の行は下線を常時出し、それ以外はホバーで同じ位置に出す */
function RowLabel({
  label,
  colorClass,
  active,
}: {
  readonly label: string;
  readonly colorClass: string;
  readonly active: boolean;
}) {
  return (
    <span className="relative flex flex-col items-start gap-1">
      <span className="text-base leading-[1.7] text-text">{label}</span>
      {active ? (
        <NavIndicator colorClass={colorClass} active />
      ) : (
        // 非現在地の行はラベルの縦位置を現在地の行と変えないよう、流れから外して置く
        <NavIndicator
          colorClass={colorClass}
          active={false}
          className="absolute top-full left-0 mt-1"
        />
      )}
    </span>
  );
}

export interface NavigationMenuRowsProps {
  readonly items: readonly NavigationItem[];
  readonly pathname: string;
  /** aria-controls の id 衝突を避けるための接頭辞。呼び出し側 (ハンバーガーメニュー / MapMenuButton) ごとに固有の値を渡す */
  readonly idPrefix: string;
  /** 項目の選択後 (遷移後) に呼ぶ。メニューを閉じる用途を想定 */
  readonly onNavigate: () => void;
}

/**
 * ハンバーガーメニュー (Requirement 7) と MapMenuButton (Requirement 11) で共有する
 * 項目の行部品。展開位置・幅は呼び出し側が持つため、ここでは行の構成と子項目の
 * 開閉だけを扱う。
 *
 * 子項目はそれぞれ独立して開閉できるため、単一の文字列ではなく Set で開状態を持つ。
 */
// Figma の罫線は INSIDE ストロークで行の高さ 48px に含まれる。border だと行送りが 49px にずれる
const DIVIDER_CLASS = 'shadow-[inset_0_-1px_0_theme(colors.gray.200)]';

export function NavigationMenuRows({
  items,
  pathname,
  idPrefix,
  onNavigate,
}: NavigationMenuRowsProps) {
  const [openLabels, setOpenLabels] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleLabel = (label: string) => {
    setOpenLabels((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <ul>
      {items.map((item, index) => {
        const active = isItemActive(item, pathname);
        const colorClass = underlineColorClassFor(item.label);
        const open = Boolean(item.children) && openLabels.has(item.label);
        const isLast = index === items.length - 1;
        // Figma (234:138・256:256): 開いた親の行自体には線がなく、区切りは最後の子行の
        // 下に出る。パネル末尾の項目はパネル外周の border-b と重なるため線を引かない
        const borderClass = !isLast && !open ? DIVIDER_CLASS : '';
        const lastChildBorderClass = isLast ? '' : DIVIDER_CLASS;

        if (!item.children) {
          return (
            <li key={item.label} className={borderClass}>
              <Link
                href={item.href as string}
                prefetch={false}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className="group flex min-h-12 flex-col items-start justify-center px-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              >
                <RowLabel
                  label={item.label}
                  colorClass={colorClass}
                  active={active}
                />
              </Link>
            </li>
          );
        }

        const submenuId = `${idPrefix}-submenu-${index}`;

        return (
          <li key={item.label} className={borderClass}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={submenuId}
              aria-current={active ? 'page' : undefined}
              onClick={() => toggleLabel(item.label)}
              className="group flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            >
              <RowLabel
                label={item.label}
                colorClass={colorClass}
                active={active}
              />
              <ExpandMoreIcon
                size={16}
                className={`shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              aria-hidden={!open}
              inert={!open ? true : undefined}
            >
              <ul
                id={submenuId}
                aria-label={`${item.label}のサブメニュー`}
                className="min-h-0 overflow-hidden shadow-[inset_1px_0_0_theme(colors.gray.200)]"
              >
                {linkableChildren(item).map((child, childIndex, children) => (
                  <li
                    key={child.href}
                    className={
                      childIndex === children.length - 1
                        ? lastChildBorderClass
                        : undefined
                    }
                  >
                    <Link
                      href={child.href}
                      prefetch={false}
                      onClick={onNavigate}
                      className="group/sub flex min-h-12 items-center pr-4 pl-8 text-sm leading-[1.6] text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                    >
                      <span className="relative inline-block">
                        {child.label}
                        <NavIndicator
                          sub
                          colorClass={colorClass}
                          active={false}
                          className="absolute top-full left-0 mt-1"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
