import type { CSSProperties } from 'react';
import Link from 'next/link';
import { MaterialIcon } from './icons';

export type PrimaryNavDestination =
  'exhibitions' | 'map' | 'timetable' | 'parking';

interface DestinationConfig {
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

// href は lib/navigation.ts の bottomNavigationItems と同じパス (/timetable, /parking は
// 別 spec が実装するまで 404)。地の画像ファイル名は destination のキーと同じ (public/images/textures/nav/)
const DESTINATIONS: Readonly<Record<PrimaryNavDestination, DestinationConfig>> =
  {
    exhibitions: { href: '/exhibitions', icon: 'festival', label: '企画一覧' },
    map: { href: '/map', icon: 'map', label: '構内マップ' },
    timetable: {
      href: '/timetable',
      icon: 'calendar_clock',
      label: 'タイムテーブル',
    },
    parking: {
      href: '/parking',
      icon: 'parking_sign',
      label: '駐車場空き情報',
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
  const { href, icon, label } = DESTINATIONS[destination];
  const bgStyle: CSSProperties = {
    backgroundImage: `url(/images/textures/nav/${destination}.webp)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <Link
      href={href}
      style={bgStyle}
      className="flex h-[171px] w-[171px] flex-col items-center justify-center gap-2 rounded-xl p-4 text-text lg:h-[160px] lg:w-[160px] lg:p-5"
    >
      <MaterialIcon
        name={icon}
        sizeClassName="text-[48px] lg:text-[56px]"
        className="text-text"
      />
      {/*
        「タイムテーブル」「駐車場空き情報」(7 文字) は lg (160px 幅、余白 20px) では
        18px はおろか 17px でも実測の自然幅が実効幅 120px を超え折り返す。
        16px (SP と同じ) まで下げてはじめて両ラベルとも 1 行に収まる (実測マージン 5.75px 以上)
      */}
      <span className="text-[16px] leading-[1.5] font-bold text-text">
        {label}
      </span>
    </Link>
  );
}

/** PC は 40px 間隔で中央揃え、SP は 2 列 × 2 行 (design.md PrimaryNavCard 節) */
export function PrimaryNavGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:flex lg:justify-center lg:gap-10">
      {PRIMARY_NAV_DESTINATIONS.map((destination) => (
        <PrimaryNavCard key={destination} destination={destination} />
      ))}
    </div>
  );
}
