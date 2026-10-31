'use client';

import { useEffect, useState } from 'react';

// CSS の lg: プレフィックスと aria-hidden / inert (CSS では表現できない) を同じ条件で
// 切り替えるため、Tailwind の lg と同じクエリを JS 側でも評価する
export function useIsAboveMapBreakpoint(): boolean {
  const [isAbove, setIsAbove] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsAbove(mql.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setIsAbove(event.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
  return isAbove;
}
