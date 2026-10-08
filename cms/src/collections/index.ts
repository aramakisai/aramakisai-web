import type { CollectionConfig } from 'payload';

import { accessFor } from '../access/payload-access';
import { isHiddenInAdmin } from '../access/policy';
import { toCmsUser } from '../access/roles';

import { Announcements } from './announcements';
import { FaqItems } from './faq-items';
import { MapAreas } from './map-areas';
import { MapPoints } from './map-points';
import { LostItems } from './lost-items';
import { Media } from './media';
import { Pages } from './pages';
import { ParkingLots } from './parking-lots';
import { ParkingStatuses } from './parking-statuses';
import { PerformanceSlots } from './performance-slots';
import { SignageSlides } from './signage-slides';
import { Sponsors } from './sponsors';
import { Stages } from './stages';
import { StudentExhibitions } from './student-exhibitions';
import { Telops } from './telops';
import { Topics } from './topics';
import { Users } from './users';

/**
 * access は登録口で一括結線する。個別ファイルで付け忘れると既定拒否が破れるため、
 * 定義側では書かず必ずここを通す。
 */
const withAccess = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  access: accessFor(collection.slug),
  admin: {
    ...collection.admin,
    hidden: ({ user }) => isHiddenInAdmin(toCmsUser(user), collection.slug),
  },
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
  MapPoints,
  Stages,
  PerformanceSlots,
  StudentExhibitions,
  ParkingLots,
  ParkingStatuses,
  SignageSlides,
  Telops,
  LostItems,
].map(withAccess);
