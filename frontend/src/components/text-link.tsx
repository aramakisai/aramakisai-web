import Link from 'next/link';
import type { ReactNode } from 'react';
import { HoverLine } from './hover-line';
import { ChevronRightIcon } from './icons';

const TONE_CLASS = {
  default: 'text-text',
  // 暗い地 (トースト) の上で使う
  inverse: 'text-background',
} as const;

export interface TextLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly tone?: keyof typeof TONE_CLASS;
  readonly className?: string;
}

export function TextLink({
  href,
  children,
  tone = 'default',
  className = '',
}: TextLinkProps) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center gap-2 text-sm leading-[1.4] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
      <ChevronRightIcon size={20} />
      <HoverLine />
    </Link>
  );
}
