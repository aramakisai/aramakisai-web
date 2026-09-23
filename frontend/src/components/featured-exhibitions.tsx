import Link from 'next/link';
import { ExhibitionCard } from './exhibition-card';
import { ChevronRightIcon } from './icons';
import {
  pickRandomExhibitions,
  type ExhibitionCardSummary,
} from '@/lib/exhibitions';

const FEATURED_COUNT = 4;

export interface FeaturedExhibitionsProps {
  /** 企画一覧の取得結果全体。取得に失敗したときは呼び出し側が空配列を渡す */
  readonly exhibitions: readonly ExhibitionCardSummary[];
}

export function FeaturedExhibitions({ exhibitions }: FeaturedExhibitionsProps) {
  const featured = pickRandomExhibitions(exhibitions, FEATURED_COUNT);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {featured.length > 0 && (
        <div className="flex gap-6 overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible">
          {featured.map((exhibition) => (
            <div
              key={`${exhibition.id}-${exhibition.category}`}
              className="w-[280px] shrink-0 lg:w-auto"
            >
              <ExhibitionCard exhibition={exhibition} />
            </div>
          ))}
        </div>
      )}
      <Link
        href="/exhibitions"
        className="flex items-center justify-end gap-2 self-end text-sm font-bold"
      >
        <span className="text-primary">企画一覧へ</span>
        <ChevronRightIcon size={20} className="text-text" />
      </Link>
    </div>
  );
}
