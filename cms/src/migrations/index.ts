import * as migration_20260827_082729_initial from './20260827_082729_initial';
import * as migration_20260827_084210_owner_unique from './20260827_084210_owner_unique';
import * as migration_20260827_084500_schema_constraints from './20260827_084500_schema_constraints';
import * as migration_20260828_134029_authentik_sub from './20260828_134029_authentik_sub';
import * as migration_20260830_073945_add_media_prefix from './20260830_073945_add_media_prefix';
import * as migration_20260917_190645_student_exhibitions_links_stage_name from './20260917_190645_student_exhibitions_links_stage_name';
import * as migration_20260918_015706_student_exhibitions_multi_category_content from './20260918_015706_student_exhibitions_multi_category_content';
import * as migration_20260918_095545_sponsors_tier_plans from './20260918_095545_sponsors_tier_plans';
import * as migration_20260919_080856_map_areas_color_geometry_validation from './20260919_080856_map_areas_color_geometry_validation';
import * as migration_20260922_132853_sponsors_type_drop from './20260922_132853_sponsors_type_drop';
import * as migration_20260922_132916_sponsors_type_add from './20260922_132916_sponsors_type_add';
import * as migration_20260922_134900_event_days_structured from './20260922_134900_event_days_structured';
import * as migration_20260922_155727_festival_meta_access_summary from './20260922_155727_festival_meta_access_summary';
import * as migration_20260923_164954_seo_fields from './20260923_164954_seo_fields';
import * as migration_20260924_130150_exhibitor_admin_ui from './20260924_130150_exhibitor_admin_ui';
import * as migration_20260924_142843_exhibitor_contact_url from './20260924_142843_exhibitor_contact_url';
import * as migration_20260927_074248_student_exhibitions_organization_name_optional from './20260927_074248_student_exhibitions_organization_name_optional';
import * as migration_20260929_054933_map_areas_multi_polygon_hex from './20260929_054933_map_areas_multi_polygon_hex';
import * as migration_20260929_093220_performance_slots_inline_time from './20260929_093220_performance_slots_inline_time';
import * as migration_20260929_111510_map_facilities from './20260929_111510_map_facilities';
import * as migration_20260929_161314_student_exhibitions_menu_open_days from './20260929_161314_student_exhibitions_menu_open_days';
import * as migration_20260930_145729_users_activated_at from './20260930_145729_users_activated_at';
import * as migration_20260930_185535_student_exhibitions_category_placement from './20260930_185535_student_exhibitions_category_placement';

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
    up: migration_20260919_080856_map_areas_color_geometry_validation.up,
    down: migration_20260919_080856_map_areas_color_geometry_validation.down,
    name: '20260919_080856_map_areas_color_geometry_validation',
  },
  {
    up: migration_20260922_132853_sponsors_type_drop.up,
    down: migration_20260922_132853_sponsors_type_drop.down,
    name: '20260922_132853_sponsors_type_drop',
  },
  {
    up: migration_20260922_132916_sponsors_type_add.up,
    down: migration_20260922_132916_sponsors_type_add.down,
    name: '20260922_132916_sponsors_type_add',
  },
  {
    up: migration_20260922_134900_event_days_structured.up,
    down: migration_20260922_134900_event_days_structured.down,
    name: '20260922_134900_event_days_structured',
  },
  {
    up: migration_20260922_155727_festival_meta_access_summary.up,
    down: migration_20260922_155727_festival_meta_access_summary.down,
    name: '20260922_155727_festival_meta_access_summary',
  },
  {
    up: migration_20260923_164954_seo_fields.up,
    down: migration_20260923_164954_seo_fields.down,
    name: '20260923_164954_seo_fields',
  },
  {
    up: migration_20260924_130150_exhibitor_admin_ui.up,
    down: migration_20260924_130150_exhibitor_admin_ui.down,
    name: '20260924_130150_exhibitor_admin_ui',
  },
  {
    up: migration_20260924_142843_exhibitor_contact_url.up,
    down: migration_20260924_142843_exhibitor_contact_url.down,
    name: '20260924_142843_exhibitor_contact_url',
  },
  {
    up: migration_20260927_074248_student_exhibitions_organization_name_optional.up,
    down: migration_20260927_074248_student_exhibitions_organization_name_optional.down,
    name: '20260927_074248_student_exhibitions_organization_name_optional',
  },
  {
    up: migration_20260929_054933_map_areas_multi_polygon_hex.up,
    down: migration_20260929_054933_map_areas_multi_polygon_hex.down,
    name: '20260929_054933_map_areas_multi_polygon_hex',
  },
  {
    up: migration_20260929_093220_performance_slots_inline_time.up,
    down: migration_20260929_093220_performance_slots_inline_time.down,
    name: '20260929_093220_performance_slots_inline_time',
  },
  {
    up: migration_20260929_111510_map_facilities.up,
    down: migration_20260929_111510_map_facilities.down,
    name: '20260929_111510_map_facilities',
  },
  {
    up: migration_20260929_161314_student_exhibitions_menu_open_days.up,
    down: migration_20260929_161314_student_exhibitions_menu_open_days.down,
    name: '20260929_161314_student_exhibitions_menu_open_days',
  },
  {
    up: migration_20260930_145729_users_activated_at.up,
    down: migration_20260930_145729_users_activated_at.down,
    name: '20260930_145729_users_activated_at',
  },
  {
    up: migration_20260930_185535_student_exhibitions_category_placement.up,
    down: migration_20260930_185535_student_exhibitions_category_placement.down,
    name: '20260930_185535_student_exhibitions_category_placement'
  },
];
