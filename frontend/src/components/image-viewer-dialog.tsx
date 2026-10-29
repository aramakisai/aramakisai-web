'use client';

import { useImperativeHandle, useRef, type Ref } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import { CloseIcon } from './icons';

export interface ImageViewerHandle {
  open: (image: { src: string; alt: string }, trigger: HTMLElement) => void;
}

export interface ImageViewerDialogProps {
  ref: Ref<ImageViewerHandle>;
  onClose?: () => void;
}

export function ImageViewerDialog({ ref, onClose }: ImageViewerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const enlargedImageRef = useRef<HTMLImageElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const previousBodyOverflowRef = useRef('');

  // 呼び出し側が DOM 直書き換え (RichText) でも React state (ギャラリー) でも使えるよう、
  // 画像は props でなく命令的に渡す
  useImperativeHandle(ref, () => ({
    open({ src, alt }, trigger) {
      const enlarged = enlargedImageRef.current;
      if (!enlarged) return;
      enlarged.src = src;
      enlarged.alt = alt;
      triggerRef.current = trigger;
      // showModal() 中は背面の操作不能化・フォーカスの閉じ込めをブラウザ既定に任せる (design.md)
      dialogRef.current?.showModal();
      sendGaEvent('image_viewer', { result: 'open' });
      previousBodyOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    },
  }));

  // dialog本体のクリックは画像・閉じるボタン以外 (背景の余白 = ::backdrop 相当) でのみ
  // event.currentTarget と event.target が一致する
  function handleScrimClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) dialogRef.current?.close();
  }

  function handleDialogClose() {
    document.body.style.overflow = previousBodyOverflowRef.current;
    triggerRef.current?.focus();
    triggerRef.current = null;
    onClose?.();
  }

  return (
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
        <img ref={enlargedImageRef} alt="" className="max-h-full max-w-full" />
        <button
          type="button"
          aria-label="閉じる"
          onClick={() => dialogRef.current?.close()}
          className="absolute right-2 top-2 flex size-12 items-center justify-center rounded-lg transition-colors duration-200 ease-out hover:bg-background/20 motion-reduce:transition-none lg:right-4 lg:top-4"
        >
          <CloseIcon className="text-background" />
        </button>
      </div>
    </dialog>
  );
}
