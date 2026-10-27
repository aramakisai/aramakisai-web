'use client';

import Link from 'next/link';
import {
  linkableChildren,
  type NavigationByPhase,
  type NavigationItem,
} from '@/lib/navigation';
import { usePhase } from '@/lib/use-phase';
import { HoverLine } from './hover-line';

export function FooterLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group relative flex h-8 w-full items-center text-sm leading-[1.6] whitespace-nowrap text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {children}
        <HoverLine />
      </Link>
    </li>
  );
}

type FooterLinkItem = NavigationItem & { href: string };

// 親が href を持たなければ子項目を並べる。お問い合わせ等は hideInFooter で外す
function footerLinks(
  items: readonly NavigationItem[],
  column: 'site' | 'guidance',
): readonly FooterLinkItem[] {
  return items
    .filter((item) => (item.footerColumn ?? 'site') === column)
    .flatMap((item) =>
      item.href ? [item as FooterLinkItem] : linkableChildren(item),
    )
    .filter((item) => !item.hideInFooter);
}

// フェーズ上書きは Cookie をクライアントで読むため、リンクの選択だけをここで行う
export function FooterSiteGuideLinks({
  navigation,
}: {
  readonly navigation: NavigationByPhase;
}) {
  return (
    <>
      {footerLinks(navigation[usePhase().phase], 'site').map((item) => (
        <FooterLink key={item.href} href={item.href}>
          {item.label}
        </FooterLink>
      ))}
    </>
  );
}

export function FooterGuidanceLinks({
  navigation,
}: {
  readonly navigation: NavigationByPhase;
}) {
  return (
    <>
      {footerLinks(navigation[usePhase().phase], 'guidance').map((item) => (
        <FooterLink key={item.href} href={item.href}>
          {item.label}
        </FooterLink>
      ))}
    </>
  );
}
