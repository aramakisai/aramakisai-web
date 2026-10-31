import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

const NAV_TABLES = [
  'navigation_live_items',
  'navigation_live_items_children',
  'navigation_pre_event_items',
  'navigation_pre_event_items_children',
] as const

// 固定ページ access の削除で page_id が NULL になる前に、ナビゲーションの参照をパスへ移す
export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of NAV_TABLES) {
    await db.execute(sql`
      UPDATE ${sql.identifier(t)} n SET
        "link_type" = 'path',
        "path" = '/access',
        "label" = p."title",
        "page_id" = NULL
      FROM "pages" p WHERE p."slug" = 'access' AND n."page_id" = p."id";`)
  }
  await db.execute(sql`DELETE FROM "pages" WHERE "slug" = 'access';`)
}

// 本文はサイト設定のアクセスタブから戻す。パスが /access の項目は元から固定ページ参照だったものとして戻す
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "pages" ("slug", "title", "content", "content_html", "embed_url", "embed_height")
    SELECT 'access', 'アクセス', "access_content", "access_content_html", "access_embed_url", "access_embed_height"
    FROM "site_settings" LIMIT 1
    ON CONFLICT ("slug") DO NOTHING;`)
  for (const t of NAV_TABLES) {
    await db.execute(sql`
      UPDATE ${sql.identifier(t)} n SET
        "link_type" = 'page',
        "path" = NULL,
        "label" = NULL,
        "page_id" = p."id"
      FROM "pages" p WHERE p."slug" = 'access' AND n."path" = '/access';`)
  }
}
