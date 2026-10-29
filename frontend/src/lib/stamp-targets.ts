import type { ExhibitionCardSummary } from './exhibitions';
import type { MypageStampTarget } from './stamp-progress';
import { isStampCategory } from './stamp-signature';

export function toStampTargets(
  cards: readonly ExhibitionCardSummary[],
): MypageStampTarget[] {
  return cards.flatMap((card) =>
    isStampCategory(card.category)
      ? [
          {
            id: card.id,
            category: card.category,
            displayName: card.displayName,
            organizationName: card.organizationName,
            areaId: card.areaIds[0] ?? null,
          },
        ]
      : [],
  );
}
