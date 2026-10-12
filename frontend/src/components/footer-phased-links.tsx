'use client';

import Link from 'next/link';
import {
  navigationItemsByPhase,
  linkableChildren,
  type NavigationItem,
} from '@/lib/navigation';
import { usePhase } from '@/lib/use-phase';

export function HoverLine() {
  return (
    <span
      aria-hidden="true"
      className="mansai-spectrum-line absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 opacity-70 transition-transform duration-200 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
    />
  );
}

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

function siteGuideLinks(
  items: readonly NavigationItem[],
): readonly (NavigationItem & { href: string })[] {
  return items
    .filter((item) => item.label !== 'ご案内')
    .flatMap((item) =>
      item.href
        ? [item as NavigationItem & { href: string }]
        : linkableChildren(item),
    );
}

// お問い合わせはサポート列に既にあるため、ここでは重複させない
function guidanceLinks(
  items: readonly NavigationItem[],
): readonly (NavigationItem & { href: string })[] {
  const guidance = items.find((item) => item.label === 'ご案内');
  if (!guidance) return [];
  return linkableChildren(guidance).filter(
    (child) => child.label !== 'お問い合わせ',
  );
}

// フェーズ上書きは Cookie をクライアントで読むため、リンクの選択だけをここで行う
export function FooterSiteGuideLinks() {
  return (
    <>
      {siteGuideLinks(navigationItemsByPhase[usePhase().phase]).map((item) => (
        <FooterLink key={item.href} href={item.href}>
          {item.label}
        </FooterLink>
      ))}
    </>
  );
}

export function FooterGuidanceLinks() {
  return (
    <>
      {guidanceLinks(navigationItemsByPhase[usePhase().phase]).map((item) => (
        <FooterLink key={item.href} href={item.href}>
          {item.label}
        </FooterLink>
      ))}
    </>
  );
}
