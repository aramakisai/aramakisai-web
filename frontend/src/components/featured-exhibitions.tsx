import { ExhibitionCard } from './exhibition-card';
import { TextLink } from './text-link';
import type { ExhibitionCardView } from '@/lib/exhibitions';
import { toItemListEntries } from '@/lib/item-list';
import { ItemListTracker } from './item-list-tracker';
import { pickRandom } from '@/lib/pick-random';

const FEATURED_COUNT = 4;

export interface FeaturedExhibitionsProps {
  /** 学生企画と企業ブースの全カード。取得に失敗したときは呼び出し側が空配列を渡す */
  readonly exhibitions: readonly ExhibitionCardView[];
}

export function FeaturedExhibitions({ exhibitions }: FeaturedExhibitionsProps) {
  const featured = pickRandom(exhibitions, FEATURED_COUNT);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {featured.length > 0 && (
        <ItemListTracker
          listId="home_featured"
          entries={toItemListEntries(featured, 1)}
        >
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
        </ItemListTracker>
      )}
      <TextLink href="/exhibitions" className="self-end">
        企画一覧へ
      </TextLink>
    </div>
  );
}
