'use client';

import { useEffect } from 'react';

export function ContextMenuGuard() {
  useEffect(() => {
    const onContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);
  return null;
}
