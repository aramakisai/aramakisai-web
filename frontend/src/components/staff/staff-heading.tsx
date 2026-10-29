import type { ReactNode } from 'react';
import { SectionHeading } from '@/components/section-heading';

export function StaffTitle({ children }: { readonly children: ReactNode }) {
  return (
    <SectionHeading
      level="h1"
      className="mb-0! text-[32px] leading-[1.25] text-text"
    >
      {children}
    </SectionHeading>
  );
}

export function StaffSectionTitle({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <SectionHeading
      level="h2"
      className="mb-0! text-[20px] leading-[1.3] text-text"
    >
      {children}
    </SectionHeading>
  );
}
