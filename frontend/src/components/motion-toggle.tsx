'use client';

import { useMotionPreference } from '@/lib/use-motion-preference';
import { PauseIcon, PlayArrowIcon } from './icons';

/**
 * 可視の pill は Figma どおり高さ 32px に留め、タップ領域の 44px 以上確保 (要件 21.5) は
 * before 擬似要素を上下 6px ずつ外側へ広げることで満たす (32 + 6*2 = 44)。button 自体を
 * 44px にすると枠の見た目がずれるため、見えない領域だけを広げる。
 */
export function MotionToggle() {
  const { reduced, toggle } = useMotionPreference();
  const Icon = reduced ? PlayArrowIcon : PauseIcon;

  return (
    <button
      type="button"
      aria-pressed={!reduced}
      onClick={toggle}
      className="relative inline-flex items-center gap-1 rounded-full border border-gray-500 bg-background px-3 py-1 text-sm leading-[1.6] text-text transition-colors before:absolute before:inset-x-0 before:-inset-y-[6px] before:content-[''] hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <Icon size={16} className="text-gray-500" />
      モーション
    </button>
  );
}
