import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

export type StaffActionKind = 'primary' | 'secondary';

const CLASSES: Readonly<Record<StaffActionKind, string>> = {
  primary:
    'flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base leading-[1.5] font-bold text-text',
  secondary:
    'flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-sm text-text hover-card-shadow hover:bg-background',
};

export function StaffActionLink({
  kind,
  href,
  children,
}: {
  readonly kind: StaffActionKind;
  readonly href: string;
  readonly children: ReactNode;
}) {
  // 認可の転送先は同一オリジンの動的ルートで、プリフェッチすると未ログインの転送を先に踏む
  return (
    <Link href={href} prefetch={false} className={CLASSES[kind]}>
      {children}
    </Link>
  );
}

export function StaffActionButton({
  kind,
  className,
  ...props
}: {
  readonly kind: StaffActionKind;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${CLASSES[kind]}${className ? ` ${className}` : ''}`}
    />
  );
}
