import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "site_settings_event_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_at" timestamp(3) with time zone NOT NULL,
  	"end_at" timestamp(3) with time zone NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"theme_word" varchar,
  	"theme_description" jsonb,
  	"theme_description_html" varchar,
  	"overview" jsonb,
  	"overview_html" varchar,
  	"contact_form_url" varchar,
  	"exhibitor_contact_url" varchar,
  	"sns_links" jsonb,
  	"og_image_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "sponsors" ALTER COLUMN "booth_number" SET DATA TYPE varchar;
  ALTER TABLE "student_exhibitions_vendor_menu" ALTER COLUMN "price" SET DATA TYPE numeric USING NULLIF(btrim("price"), '')::numeric;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "exhibit_booth_number" SET DATA TYPE varchar;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "vendor_booth_number" SET DATA TYPE varchar;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "other_booth_number" SET DATA TYPE varchar;
  ALTER TABLE "sponsors" ADD COLUMN "_order" varchar;
  ALTER TABLE "faq_items" ADD COLUMN "_order" varchar;
  ALTER TABLE "map_areas" ADD COLUMN "_order" varchar;
  ALTER TABLE "stages" ADD COLUMN "_order" varchar;
  ALTER TABLE "parking_lots" ADD COLUMN "_order" varchar;
  ALTER TABLE "signage_groups_rels" ADD COLUMN "telops_id" integer;
  ALTER TABLE "site_settings_event_days" ADD CONSTRAINT "site_settings_event_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_event_days_order_idx" ON "site_settings_event_days" USING btree ("_order");
  CREATE INDEX "site_settings_event_days_parent_id_idx" ON "site_settings_event_days" USING btree ("_parent_id");
  CREATE INDEX "site_settings_og_image_idx" ON "site_settings" USING btree ("og_image_id");
  CREATE INDEX "site_settings_rels_order_idx" ON "site_settings_rels" USING btree ("order");
  CREATE INDEX "site_settings_rels_parent_idx" ON "site_settings_rels" USING btree ("parent_id");
  CREATE INDEX "site_settings_rels_path_idx" ON "site_settings_rels" USING btree ("path");
  CREATE INDEX "site_settings_rels_media_id_idx" ON "site_settings_rels" USING btree ("media_id");
  ALTER TABLE "signage_groups_rels" ADD CONSTRAINT "signage_groups_rels_telops_fk" FOREIGN KEY ("telops_id") REFERENCES "public"."telops"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sponsors__order_idx" ON "sponsors" USING btree ("_order");
  CREATE INDEX "faq_items__order_idx" ON "faq_items" USING btree ("_order");
  CREATE INDEX "map_areas__order_idx" ON "map_areas" USING btree ("_order");
  CREATE INDEX "stages__order_idx" ON "stages" USING btree ("_order");
  CREATE INDEX "parking_lots__order_idx" ON "parking_lots" USING btree ("_order");
  CREATE INDEX "signage_groups_rels_telops_id_idx" ON "signage_groups_rels" USING btree ("telops_id");
  INSERT INTO "site_settings" ("id", "name", "theme_word", "theme_description", "theme_description_html", "overview", "overview_html", "contact_form_url", "exhibitor_contact_url", "sns_links", "og_image_id", "updated_at", "created_at")
    SELECT "id", "name", "theme_word", "theme_description", "theme_description_html", "overview", "overview_html", "contact_form_url", "exhibitor_contact_url", "sns_links", "og_image_id", "updated_at", "created_at" FROM "festival_meta";
  SELECT setval(pg_get_serial_sequence('site_settings', 'id'), COALESCE(max("id"), 0) + 1, false) FROM "site_settings";
  INSERT INTO "site_settings_event_days" ("_order", "_parent_id", "id", "start_at", "end_at", "label")
    SELECT "_order", "_parent_id", "id", "start_at", "end_at", "label" FROM "festival_meta_event_days";
  INSERT INTO "site_settings_rels" ("order", "parent_id", "path", "media_id")
    SELECT r."order", s."id", r."path", r."media_id" FROM "page_home_rels" r CROSS JOIN (SELECT "id" FROM "site_settings" LIMIT 1) s WHERE r."path" = 'hero_images' AND r."media_id" IS NOT NULL;
  INSERT INTO "signage_groups_rels" ("order", "parent_id", "path", "telops_id")
    SELECT row_number() OVER (PARTITION BY g."id" ORDER BY t."_order", t."id"), g."id", 'telops', t."id" FROM "signage_groups" g CROSS JOIN "telops" t WHERE g."is_all" IS NOT TRUE;`)

  // 並び替えキーは0-9a-zの2桁(36件まで)または3桁。Payloadのorderableは文字列の大小比較で並べる
  const digit = (n: string) => `substr('0123456789abcdefghijklmnopqrstuvwxyz', (${n}) + 1, 1)`
  const orderSpecs: Record<string, string> = {
    faq_items: '"sort" ASC NULLS LAST, "created_at" DESC, "id" DESC',
    map_areas: '"sort" ASC NULLS LAST, "created_at" DESC, "id" DESC',
    parking_lots: '"sort" ASC NULLS LAST, "created_at" DESC, "id" DESC',
    sponsors: '"sort" ASC NULLS LAST, "created_at" DESC, "id" DESC',
    stages: 'COALESCE("sort", 0) ASC, "id" ASC',
  }
  for (const [table, orderBy] of Object.entries(orderSpecs)) {
    await db.execute(
      sql.raw(`UPDATE "${table}" t SET "_order" = CASE WHEN s.r < 36 THEN 'a' || ${digit('s.r')} ELSE 'b' || ${digit('s.r / 36')} || ${digit('s.r % 36')} END
        FROM (SELECT "id", (row_number() OVER (ORDER BY ${orderBy}) - 1)::int AS r FROM "${table}") s WHERE t."id" = s."id"`),
    )
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings_event_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_settings_event_days" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_rels" CASCADE;
  DELETE FROM "signage_groups_rels" WHERE "path" = 'telops';
  ALTER TABLE "signage_groups_rels" DROP CONSTRAINT "signage_groups_rels_telops_fk";
  
  DROP INDEX "sponsors__order_idx";
  DROP INDEX "faq_items__order_idx";
  DROP INDEX "map_areas__order_idx";
  DROP INDEX "stages__order_idx";
  DROP INDEX "parking_lots__order_idx";
  DROP INDEX "signage_groups_rels_telops_id_idx";
  ALTER TABLE "sponsors" ALTER COLUMN "booth_number" SET DATA TYPE numeric USING NULLIF(btrim("booth_number"), '')::numeric;
  ALTER TABLE "student_exhibitions_vendor_menu" ALTER COLUMN "price" SET DATA TYPE varchar;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "exhibit_booth_number" SET DATA TYPE numeric USING NULLIF(btrim("exhibit_booth_number"), '')::numeric;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "vendor_booth_number" SET DATA TYPE numeric USING NULLIF(btrim("vendor_booth_number"), '')::numeric;
  ALTER TABLE "student_exhibitions" ALTER COLUMN "other_booth_number" SET DATA TYPE numeric USING NULLIF(btrim("other_booth_number"), '')::numeric;
  ALTER TABLE "sponsors" DROP COLUMN "_order";
  ALTER TABLE "faq_items" DROP COLUMN "_order";
  ALTER TABLE "map_areas" DROP COLUMN "_order";
  ALTER TABLE "stages" DROP COLUMN "_order";
  ALTER TABLE "parking_lots" DROP COLUMN "_order";
  ALTER TABLE "signage_groups_rels" DROP COLUMN "telops_id";`)
}
