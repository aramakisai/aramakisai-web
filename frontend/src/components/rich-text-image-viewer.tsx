'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { CloseIcon } from './icons';

export interface RichTextImageViewerProps {
  children: ReactNode;
}

const IMAGE_BUTTON_ATTR = 'data-rich-text-image';

/**
 * RichText はサーバーコンポーネントのまま HTML を描画するため、本文中の img を
 * 選択可能なボタンで包む処理はマウント後にここで DOM を直接書き換えて行う。
 * dangerouslySetInnerHTML の中身は React が差分管理しないため、書き換えても
 * 再描画で壊れない (design.md)。本文は 1 ページにつき 1 回しか描画されない前提で
 * 依存配列を空にしており、マウント後に本文の HTML 自体が変わるケースは想定しない。
 */
export function RichTextImageViewer({ children }: RichTextImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const enlargedImageRef = useRef<HTMLImageElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.querySelectorAll('img').forEach((img) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(IMAGE_BUTTON_ATTR, '');
      button.setAttribute('aria-label', `画像を拡大: ${img.alt}`);
      img.replaceWith(button);
      button.appendChild(img);
    });
  }, []);

  function openViewer(img: HTMLImageElement, trigger: HTMLElement) {
    const mediaId = img.getAttribute('data-media-id');
    const enlarged = enlargedImageRef.current;
    if (!mediaId || !enlarged) return;

    // 本文側 (rich-text.tsx) も toAssetUrl(id) で original を出しているため、
    // 拡大時に本文より小さい派生サイズへ差し替わらないよう同じ original を使う
    enlarged.src = toAssetUrl(mediaId) ?? '';
    enlarged.alt = img.alt;
    triggerRef.current = trigger;
    // showModal() 中は背面の操作不能化・フォーカスの閉じ込めをブラウザ既定に任せる (design.md)
    dialogRef.current?.showModal();
    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  // クリックはコンテナへの 1 つのリスナーで受け、画像のボタンだけを拾う。
  // リンク等の他の要素の選択はここで止めず素通しにする。
  function handleContainerClick(event: React.MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      `button[${IMAGE_BUTTON_ATTR}]`,
    );
    if (!button) return;
    const img = button.querySelector('img');
    if (!img) return;
    openViewer(img, button);
  }

  // dialog本体のクリックは画像・閉じるボタン以外 (背景の余白 = ::backdrop 相当) でのみ
  // event.currentTarget と event.target が一致する
  function handleScrimClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) dialogRef.current?.close();
  }

  function handleDialogClose() {
    document.body.style.overflow = previousBodyOverflowRef.current;
    triggerRef.current?.focus();
    triggerRef.current = null;
  }

  return (
    <>
      <div ref={containerRef} onClick={handleContainerClick}>
        {children}
      </div>
      <dialog
        ref={dialogRef}
        aria-label="画像を拡大表示"
        onClose={handleDialogClose}
        className={[
          'm-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-transparent p-0',
          'opacity-0 open:opacity-100 open:starting:opacity-0',
          // pseudo-element variant (backdrop) は常に最後に置く必要があるため、
          // open/starting は backdrop の手前に置く (backdrop:open: の順だと
          // motion-reduce のケースと同じ理由で ::backdrop に :is() が付かず常に不一致になる)
          'backdrop:bg-text/85 backdrop:opacity-0 open:backdrop:opacity-100 open:starting:backdrop:opacity-0',
          // display の切替 (open 属性) を allow-discrete でフェード終了まで遅らせ、閉じる際もそのまま同じ手順でフェードアウトする
          'transition-[opacity,display,overlay] duration-200 [transition-behavior:allow-discrete]',
          'backdrop:transition-[opacity,display,overlay] backdrop:duration-200 backdrop:[transition-behavior:allow-discrete]',
          // pseudo-element variant (backdrop) は常に最後に置く必要があるため、
          // motion-reduce はその手前に挟む (backdrop:motion-reduce: の順だと
          // 生成される :is() が ::backdrop の後ろに付き常に不一致になる)
          'motion-reduce:transition-none motion-reduce:backdrop:transition-none',
        ].join(' ')}
      >
        <div
          className="relative flex h-full w-full items-center justify-center p-4 lg:p-16"
          onClick={handleScrimClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 実ファイルは配信時に解決するため next/image の最適化対象にできない */}
          <img
            ref={enlargedImageRef}
            alt=""
            className="max-h-full max-w-full"
          />
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => dialogRef.current?.close()}
            className="absolute right-2 top-2 flex size-12 items-center justify-center lg:right-4 lg:top-4"
          >
            <CloseIcon className="text-background" />
          </button>
        </div>
      </dialog>
    </>
  );
}
