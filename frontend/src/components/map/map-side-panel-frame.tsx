'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

export interface MapSidePanelFrameProps extends Omit<
  ComponentProps<'div'>,
  'className' | 'children' | 'title'
> {
  /** 固定ヘッダー(検索欄)。省略するとヘッダーと区切り線を出さない */
  readonly header?: ReactNode;
  /** ヘッダーの下でスクロールする本体 */
  readonly children: ReactNode;
}

export function MapSidePanelFrame({
  header,
  children,
  ...rest
}: MapSidePanelFrameProps) {
  const isAbove = useIsAboveMapBreakpoint();

  return (
    <div
      {...rest}
      data-map-side-panel
      aria-hidden={!isAbove}
      inert={!isAbove}
      // 表示自体は CSS のブレークポイントに委ね、aria-hidden/inert は
      // 支援技術とキーボードフォーカスの除外専用に JS 側で同期させる
      className="absolute top-6 bottom-[calc(1.5rem+var(--map-nav,0px))] left-6 z-[1000] hidden w-[348px] max-w-[calc(50%-2rem)] flex-col gap-4 overflow-visible rounded-xl border border-gray-200 bg-white p-6 shadow-card lg:flex"
    >
      {header}
      {/* 検索欄とリストの区切り線。Figma ではリスト未選択時にも常に表示される */}
      {header && (
        <span
          data-testid="panel-divider"
          aria-hidden="true"
          className="h-px w-full shrink-0 bg-gray-200"
        />
      )}
      {/* 検索欄は固定ヘッダーとして残し、リストだけを内側でスクロールさせる */}
      <div data-map-scroll-root className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
