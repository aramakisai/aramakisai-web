import { ExhibitionCard } from './exhibition-card';
import { TextLink } from './text-link';
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
      <TextLink href="/exhibitions" className="self-end">
        企画一覧へ
      </TextLink>
    </div>
  );
}
