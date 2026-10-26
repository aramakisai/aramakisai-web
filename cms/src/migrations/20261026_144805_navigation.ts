import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

type Color = 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'accent' | 'accent-alt'
type Child = { label: string; path: string; hideInFooter?: boolean }
type Item = { label: string; path?: string; color: Color; guidance?: boolean; children?: Child[] }

const GUIDANCE: Child[] = [
  { label: 'アクセス', path: '/access' },
  { label: 'ご来場の際の注意点', path: '/guidelines' },
  { label: '案内所・落とし物・迷子', path: '/info-desk' },
  { label: 'ごみの分別のお願い', path: '/waste' },
  { label: 'よくある質問', path: '/faq' },
  { label: 'お問い合わせ', path: '/contact', hideInFooter: true },
]

const ITEMS: Record<'live' | 'pre_event', Item[]> = {
  live: [
    { label: '企画一覧', path: '/exhibitions', color: 'primary' },
    { label: '構内マップ', path: '/map', color: 'secondary' },
    { label: 'タイムテーブル', path: '/timetable', color: 'info' },
    {
      label: 'お知らせ',
      color: 'warning',
      children: [
        { label: 'お知らせ一覧', path: '/announcements' },
        { label: 'トピック', path: '/topics' },
      ],
    },
    { label: 'ご案内', color: 'success', guidance: true, children: GUIDANCE },
  ],
  pre_event: [
    { label: '荒牧祭について', path: '/#about', color: 'accent-alt' },
    { label: 'お知らせ', path: '/announcements', color: 'warning' },
    { label: 'トピック', path: '/topics', color: 'primary' },
    { label: 'ご案内', color: 'success', guidance: true, children: GUIDANCE },
    {
      label: '協賛',
      color: 'accent',
      children: [
        { label: '広告協賛', path: '/sponsors/ad' },
        { label: '地域協賛', path: '/sponsors/local' },
      ],
    },
  ],
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_navigation_live_items_color" AS ENUM('primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt');
  CREATE TYPE "public"."enum_navigation_live_items_footer_column" AS ENUM('site', 'guidance');
  CREATE TYPE "public"."enum_navigation_pre_event_items_color" AS ENUM('primary', 'secondary', 'info', 'warning', 'success', 'accent', 'accent-alt');
  CREATE TYPE "public"."enum_navigation_pre_event_items_footer_column" AS ENUM('site', 'guidance');
  CREATE TABLE "navigation_live_items_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page_id" integer,
  	"path" varchar,
  	"label" varchar,
  	"hide_in_footer" boolean DEFAULT false
  );
  
  CREATE TABLE "navigation_live_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page_id" integer,
  	"path" varchar,
  	"label" varchar,
  	"color" "enum_navigation_live_items_color" DEFAULT 'primary' NOT NULL,
  	"footer_column" "enum_navigation_live_items_footer_column" DEFAULT 'site' NOT NULL
  );
  
  CREATE TABLE "navigation_pre_event_items_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page_id" integer,
  	"path" varchar,
  	"label" varchar,
  	"hide_in_footer" boolean DEFAULT false
  );
  
  CREATE TABLE "navigation_pre_event_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"page_id" integer,
  	"path" varchar,
  	"label" varchar,
  	"color" "enum_navigation_pre_event_items_color" DEFAULT 'primary' NOT NULL,
  	"footer_column" "enum_navigation_pre_event_items_footer_column" DEFAULT 'site' NOT NULL
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "navigation_live_items_children" ADD CONSTRAINT "navigation_live_items_children_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_live_items_children" ADD CONSTRAINT "navigation_live_items_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_live_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_live_items" ADD CONSTRAINT "navigation_live_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_live_items" ADD CONSTRAINT "navigation_live_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_pre_event_items_children" ADD CONSTRAINT "navigation_pre_event_items_children_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_pre_event_items_children" ADD CONSTRAINT "navigation_pre_event_items_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_pre_event_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_pre_event_items" ADD CONSTRAINT "navigation_pre_event_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_pre_event_items" ADD CONSTRAINT "navigation_pre_event_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "navigation_live_items_children_order_idx" ON "navigation_live_items_children" USING btree ("_order");
  CREATE INDEX "navigation_live_items_children_parent_id_idx" ON "navigation_live_items_children" USING btree ("_parent_id");
  CREATE INDEX "navigation_live_items_children_page_idx" ON "navigation_live_items_children" USING btree ("page_id");
  CREATE INDEX "navigation_live_items_order_idx" ON "navigation_live_items" USING btree ("_order");
  CREATE INDEX "navigation_live_items_parent_id_idx" ON "navigation_live_items" USING btree ("_parent_id");
  CREATE INDEX "navigation_live_items_page_idx" ON "navigation_live_items" USING btree ("page_id");
  CREATE INDEX "navigation_pre_event_items_children_order_idx" ON "navigation_pre_event_items_children" USING btree ("_order");
  CREATE INDEX "navigation_pre_event_items_children_parent_id_idx" ON "navigation_pre_event_items_children" USING btree ("_parent_id");
  CREATE INDEX "navigation_pre_event_items_children_page_idx" ON "navigation_pre_event_items_children" USING btree ("page_id");
  CREATE INDEX "navigation_pre_event_items_order_idx" ON "navigation_pre_event_items" USING btree ("_order");
  CREATE INDEX "navigation_pre_event_items_parent_id_idx" ON "navigation_pre_event_items" USING btree ("_parent_id");
  CREATE INDEX "navigation_pre_event_items_page_idx" ON "navigation_pre_event_items" USING btree ("page_id");`)


  // 本番と開発で pages の有無が異なるため、slug で引けたものだけ page に、無ければ path + label にする
  const pages = await db.execute(sql`SELECT id, slug FROM "pages"`)
  const pageIdBySlug = new Map<string, number>(
    (pages.rows as { id: number; slug: string }[]).map((r) => [r.slug, r.id]),
  )
  const link = (path: string | undefined, label: string) => {
    const pageId = path && /^\/[^/#]+$/.test(path) ? (pageIdBySlug.get(path.slice(1)) ?? null) : null
    return pageId === null ? { pageId, path: path ?? null, label } : { pageId, path: null, label: null }
  }

  await db.execute(sql`INSERT INTO "navigation" ("id", "updated_at", "created_at") VALUES (1, now(), now())`)
  for (const phase of ['live', 'pre_event'] as const) {
    const items = sql.raw(`"navigation_${phase}_items"`)
    const kids = sql.raw(`"navigation_${phase}_items_children"`)
    for (const [i, item] of ITEMS[phase].entries()) {
      const id = `${phase}-${i}`
      const l = link(item.path, item.label)
      await db.execute(sql`
        INSERT INTO ${items} ("_order", "_parent_id", "id", "page_id", "path", "label", "color", "footer_column")
        VALUES (${i + 1}, 1, ${id}, ${l.pageId}, ${l.path}, ${l.label}, ${item.color}, ${item.guidance ? 'guidance' : 'site'})`)
      for (const [j, child] of (item.children ?? []).entries()) {
        const c = link(child.path, child.label)
        await db.execute(sql`
          INSERT INTO ${kids} ("_order", "_parent_id", "id", "page_id", "path", "label", "hide_in_footer")
          VALUES (${j + 1}, ${id}, ${`${id}-${j}`}, ${c.pageId}, ${c.path}, ${c.label}, ${child.hideInFooter ?? false})`)
      }
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "navigation_live_items_children" CASCADE;
  DROP TABLE "navigation_live_items" CASCADE;
  DROP TABLE "navigation_pre_event_items_children" CASCADE;
  DROP TABLE "navigation_pre_event_items" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TYPE "public"."enum_navigation_live_items_color";
  DROP TYPE "public"."enum_navigation_live_items_footer_column";
  DROP TYPE "public"."enum_navigation_pre_event_items_color";
  DROP TYPE "public"."enum_navigation_pre_event_items_footer_column";`)
}
