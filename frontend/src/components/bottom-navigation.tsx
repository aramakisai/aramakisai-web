'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { FestivalPhase } from '@/lib/phase';
import { bottomNavigationItems, isItemActive } from '@/lib/navigation';
import { MaterialIcon } from '@/components/icons';

export interface BottomNavigationProps {
  readonly phase: FestivalPhase;
}

// PrimaryNavCard (Requirement 3) のバリアントごとの色割当と揃えている
const INDICATOR_COLOR_CLASS: Readonly<Record<string, string>> = {
  '/exhibitions': 'bg-primary',
  '/map': 'bg-secondary',
  '/': 'bg-accent-alt',
  '/timetable': 'bg-info',
  '/parking': 'bg-accent',
};

export function BottomNavigation({ phase }: BottomNavigationProps) {
  const pathname = usePathname();

  // 開催前フェーズでは DOM に出さない (要件 8.1, 8.3)。1024px 以上の除外は画面幅を
  // サーバーで判定できないため CSS (lg:hidden) で行い、支援技術とキーボードの対象からも
  // display:none によって除外する (要件 8.2)
  if (phase !== 'live') return null;

  return (
    <nav
      aria-label="下部ナビゲーション"
      // border-t は 64px の外側に 1px 加算されてしまいセーフエリア抜きの高さが 65px になる
      // (layout.tsx の下端余白のスペーサー・phase-toggle のずらし量は 64px 前提)。
      // box-shadow は要素サイズに寄与しないため、ここでは境界線を inset shadow で描く
      className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[inset_0_1px_0_theme(colors.gray.200)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-16 w-full">
        {bottomNavigationItems.map((item) => {
          const active = isItemActive(item, pathname);
          return (
            <li key={item.href} className="flex h-full flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="relative flex w-full flex-col items-center justify-center gap-0.5 text-text"
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0 left-0 h-[2px] w-full ${
                    INDICATOR_COLOR_CLASS[item.href] ?? 'bg-primary'
                  } ${active ? 'opacity-100' : 'opacity-0'}`}
                />
                <MaterialIcon name={item.icon} size={24} />
                <span className="text-body-xs">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
