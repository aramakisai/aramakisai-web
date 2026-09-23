import Link from 'next/link';
import { MaterialIcon } from './icons';

export type PrimaryNavDestination =
  'exhibitions' | 'map' | 'timetable' | 'parking';

interface DestinationConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
  readonly bgClass: string;
}

// href は lib/navigation.ts の bottomNavigationItems と同じパス (/timetable, /parking は
// 別 spec が実装するまで 404)。背景色は各バリアントのトークン色を color/background に 18% で
// 重ねた濃度で、bg-*/[0.18] は body の bg-background 地の上でのみこの濃度になる。
const DESTINATIONS: Readonly<Record<PrimaryNavDestination, DestinationConfig>> =
  {
    exhibitions: {
      href: '/exhibitions',
      icon: 'festival',
      label: '企画一覧',
      bgClass: 'bg-primary/[0.18]',
    },
    map: {
      href: '/map',
      icon: 'map',
      label: '構内マップ',
      bgClass: 'bg-secondary/[0.18]',
    },
    timetable: {
      href: '/timetable',
      icon: 'calendar_clock',
      label: 'タイムテーブル',
      bgClass: 'bg-info/[0.18]',
    },
    parking: {
      href: '/parking',
      icon: 'parking_sign',
      label: '駐車場空き情報',
      bgClass: 'bg-accent/[0.18]',
    },
  };

export const PRIMARY_NAV_DESTINATIONS: readonly PrimaryNavDestination[] = [
  'exhibitions',
  'map',
  'timetable',
  'parking',
];

export interface PrimaryNavCardProps {
  readonly destination: PrimaryNavDestination;
}

export function PrimaryNavCard({ destination }: PrimaryNavCardProps) {
  const { href, icon, label, bgClass } = DESTINATIONS[destination];

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-2 rounded-md border border-gray-200 py-6 text-text ${bgClass}`}
    >
      <MaterialIcon name={icon} size={32} />
      <span className="text-base leading-[1.7] text-text">{label}</span>
    </Link>
  );
}

/** SP は 2 列 × 2 行、PC は 1 行 4 列 (Figma `160:108` / `155:734` 実測) */
export function PrimaryNavGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {PRIMARY_NAV_DESTINATIONS.map((destination) => (
        <PrimaryNavCard key={destination} destination={destination} />
      ))}
    </div>
  );
}
