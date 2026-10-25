import {
  getExhibitionCatalog,
  type ExhibitionCatalog,
} from '@/lib/exhibitions';
import { TouchExhibitions } from '@/components/signage/touch/touch-exhibitions';
import { loadForIsr } from '@/lib/isr';

export const revalidate = 60;

const EMPTY_CATALOG: ExhibitionCatalog = { cards: [], areas: [] };

export default async function TouchExhibitionsPage() {
  const { cards } = await loadForIsr(getExhibitionCatalog, EMPTY_CATALOG);
  return <TouchExhibitions cards={cards} />;
}
