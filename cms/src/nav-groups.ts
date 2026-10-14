type NavGroup = 'サイト掲載' | '企画・ステージ' | '会場・マップ' | '当日運営' | 'サイネージ' | '管理';

/** admin.hidden の定義 (signage_settings) は分類せず含めない。 */
export const NAV_GROUPS: Readonly<Record<string, NavGroup>> = {
  announcements: 'サイト掲載',
  topics: 'サイト掲載',
  pages: 'サイト掲載',
  faq_items: 'サイト掲載',
  sponsors: 'サイト掲載',
  student_exhibitions: '企画・ステージ',
  stages: '企画・ステージ',
  performance_slots: '企画・ステージ',
  map_areas: '会場・マップ',
  map_points: '会場・マップ',
  parking_lots: '会場・マップ',
  parking_statuses: '当日運営',
  lost_items: '当日運営',
  signage_slides: 'サイネージ',
  signage_groups: 'サイネージ',
  telops: 'サイネージ',
  site_settings: '管理',
  users: '管理',
  media: '管理',
};
