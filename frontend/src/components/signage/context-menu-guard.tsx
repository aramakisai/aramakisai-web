'use client';

import { useEffect } from 'react';

export function ContextMenuGuard() {
  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    const onDragStart = (e: Event) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    };
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', onDragStart);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', onDragStart);
    };
  }, []);
  return null;
}
