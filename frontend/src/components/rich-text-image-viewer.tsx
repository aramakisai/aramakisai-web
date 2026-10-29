'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import {
  ImageViewerDialog,
  type ImageViewerHandle,
} from './image-viewer-dialog';

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
  const viewerRef = useRef<ImageViewerHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.querySelectorAll('img').forEach((img) => {
      // StrictMode は開発時に effect を 2 回走らせるため、二重にボタンで包まない
      if (img.parentElement?.hasAttribute(IMAGE_BUTTON_ATTR)) return;
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
    if (!mediaId) return;

    // 本文側 (rich-text.tsx) も toAssetUrl(id) で original を出しているため、
    // 拡大時に本文より小さい派生サイズへ差し替わらないよう同じ original を使う
    viewerRef.current?.open(
      { src: toAssetUrl(mediaId) ?? '', alt: img.alt },
      trigger,
    );
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

  return (
    <>
      <div ref={containerRef} onClick={handleContainerClick}>
        {children}
      </div>
      <ImageViewerDialog ref={viewerRef} />
    </>
  );
}
