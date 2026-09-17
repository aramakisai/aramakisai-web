import type { CollectionConfig } from 'payload';

import { accessFor } from '../access/payload-access';

import { Announcements } from './announcements';
import { FaqItems } from './faq-items';
import { MapAreas } from './map-areas';
import { Media } from './media';
import { Pages } from './pages';
import { PerformanceSlots } from './performance-slots';
import { Sponsors } from './sponsors';
import { Stages } from './stages';
import { StudentExhibitions } from './student-exhibitions';
import { TimeSlots } from './time-slots';
import { Topics } from './topics';
import { Users } from './users';

/**
 * access は登録口で一括結線する。個別ファイルで付け忘れると既定拒否が破れるため、
 * 定義側では書かず必ずここを通す。
 */
const withAccess = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  access: accessFor(collection.slug),
});

/** コレクションの登録口。1 コレクション 1 ファイルとし、ここへ 1 行追加するだけにとどめる。 */
export const collections: CollectionConfig[] = [
  Users,
  Media,
  Announcements,
  Topics,
  Pages,
  Sponsors,
  FaqItems,
  MapAreas,
  Stages,
  TimeSlots,
  PerformanceSlots,
  StudentExhibitions,
].map(withAccess);
