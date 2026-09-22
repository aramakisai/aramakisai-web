import * as migration_20260827_082729_initial from './20260827_082729_initial';
import * as migration_20260827_084210_owner_unique from './20260827_084210_owner_unique';
import * as migration_20260827_084500_schema_constraints from './20260827_084500_schema_constraints';
import * as migration_20260828_134029_authentik_sub from './20260828_134029_authentik_sub';
import * as migration_20260830_073945_add_media_prefix from './20260830_073945_add_media_prefix';
import * as migration_20260917_190645_student_exhibitions_links_stage_name from './20260917_190645_student_exhibitions_links_stage_name';
import * as migration_20260918_015706_student_exhibitions_multi_category_content from './20260918_015706_student_exhibitions_multi_category_content';
import * as migration_20260918_095545_sponsors_tier_plans from './20260918_095545_sponsors_tier_plans';
import * as migration_20260922_132853_sponsors_type_drop from './20260922_132853_sponsors_type_drop';
import * as migration_20260922_132916_sponsors_type_add from './20260922_132916_sponsors_type_add';

export const migrations = [
  {
    up: migration_20260827_082729_initial.up,
    down: migration_20260827_082729_initial.down,
    name: '20260827_082729_initial',
  },
  {
    up: migration_20260827_084210_owner_unique.up,
    down: migration_20260827_084210_owner_unique.down,
    name: '20260827_084210_owner_unique',
  },
  {
    up: migration_20260827_084500_schema_constraints.up,
    down: migration_20260827_084500_schema_constraints.down,
    name: '20260827_084500_schema_constraints',
  },
  {
    up: migration_20260828_134029_authentik_sub.up,
    down: migration_20260828_134029_authentik_sub.down,
    name: '20260828_134029_authentik_sub',
  },
  {
    up: migration_20260830_073945_add_media_prefix.up,
    down: migration_20260830_073945_add_media_prefix.down,
    name: '20260830_073945_add_media_prefix',
  },
  {
    up: migration_20260917_190645_student_exhibitions_links_stage_name.up,
    down: migration_20260917_190645_student_exhibitions_links_stage_name.down,
    name: '20260917_190645_student_exhibitions_links_stage_name',
  },
  {
    up: migration_20260918_015706_student_exhibitions_multi_category_content.up,
    down: migration_20260918_015706_student_exhibitions_multi_category_content.down,
    name: '20260918_015706_student_exhibitions_multi_category_content',
  },
  {
    up: migration_20260918_095545_sponsors_tier_plans.up,
    down: migration_20260918_095545_sponsors_tier_plans.down,
    name: '20260918_095545_sponsors_tier_plans',
  },
  {
    up: migration_20260922_132853_sponsors_type_drop.up,
    down: migration_20260922_132853_sponsors_type_drop.down,
    name: '20260922_132853_sponsors_type_drop',
  },
  {
    up: migration_20260922_132916_sponsors_type_add.up,
    down: migration_20260922_132916_sponsors_type_add.down,
    name: '20260922_132916_sponsors_type_add'
  },
];
