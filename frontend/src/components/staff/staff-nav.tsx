import Link from 'next/link';
import { MaterialIcon } from '@/components/icons';
import { StaffActionLink } from './staff-action-button';

export type StaffNavSelected = 'dashboard' | 'exchanges' | 'none' | 'scan';

const TABS = [
  { id: 'dashboard', href: '/staff', icon: 'bar_chart', label: '集計' },
  {
    id: 'exchanges',
    href: '/staff/exchanges',
    icon: 'list_alt',
    label: '交換済み一覧',
  },
] as const;

export function StaffNav({
  selected,
}: {
  readonly selected: StaffNavSelected;
}) {
  return (
    <nav aria-label="管理者メニュー" className="flex flex-col gap-4">
      <div className="flex h-16 border-b border-gray-200">
        {TABS.map((t) => {
          const current = t.id === selected;
          return (
            <Link
              key={t.id}
              href={t.href}
              prefetch={false}
              aria-current={current ? 'page' : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-clip text-text"
            >
              <MaterialIcon name={t.icon} />
              <span className="text-[10px] leading-[1.6]">{t.label}</span>
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent-alt ${current ? '' : 'opacity-0'}`}
              />
            </Link>
          );
        })}
      </div>
      {selected !== 'scan' && (
        <StaffActionLink kind="primary" href="/staff/scan">
          <MaterialIcon name="qr_code_scanner" />
          QRを読み取る
        </StaffActionLink>
      )}
    </nav>
  );
}
