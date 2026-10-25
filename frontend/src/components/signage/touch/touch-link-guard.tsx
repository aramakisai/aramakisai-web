'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toTouchHref } from '@/lib/signage-touch';

const BLOCKED_ATTR = 'data-touch-blocked';

function markBlocked(root: ParentNode) {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (toTouchHref(a.getAttribute('href') ?? '') === null) {
      a.setAttribute(BLOCKED_ATTR, '');
    }
  }
}

export function TouchLinkGuard() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      const next = toTouchHref(href);
      // ページ内アンカーは toTouchHref がそのまま返すので既定動作に任せる
      if (next === href && href.startsWith('#')) return;
      e.preventDefault();
      if (next !== null) router.push(next);
    };
    // 子の click ハンドラ(Next の Link など)より先に止める必要がある
    document.addEventListener('click', onClick, true);

    // 遮断の見た目は CSS で出すため、クリック前に属性を付けておく
    markBlocked(document);
    const observer = new MutationObserver(() => markBlocked(document));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    return () => {
      document.removeEventListener('click', onClick, true);
      observer.disconnect();
    };
  }, [router]);

  return null;
}
