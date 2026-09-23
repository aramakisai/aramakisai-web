import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowBackIcon } from '@/components/icons';

export interface BackLinkProps {
  readonly href: string;
  readonly label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-500 hover:text-primary"
    >
      <ArrowBackIcon size={18} className="text-text" />
      {label}
    </Link>
  );
}

export interface DetailColumnProps {
  readonly children: ReactNode;
}

export function DetailColumn({ children }: DetailColumnProps) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-12 lg:px-20 lg:pt-12 lg:pb-20">
      <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6 lg:gap-8">
        {children}
      </div>
    </div>
  );
}
