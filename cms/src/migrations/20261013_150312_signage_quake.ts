import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signage_groups" ADD COLUMN "is_quake" boolean DEFAULT false;
  ALTER TABLE "signage_groups" ADD COLUMN "quake_slides_warning_id" integer;
  ALTER TABLE "signage_groups" ADD COLUMN "quake_slides_calm_id" integer;
  ALTER TABLE "signage_groups" ADD COLUMN "quake_slides_evacuate_id" integer;
  ALTER TABLE "signage_groups" ADD COLUMN "quake_slides_cancelled_id" integer;
  ALTER TABLE "signage_groups" ADD CONSTRAINT "signage_groups_quake_slides_warning_id_signage_slides_id_fk" FOREIGN KEY ("quake_slides_warning_id") REFERENCES "public"."signage_slides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signage_groups" ADD CONSTRAINT "signage_groups_quake_slides_calm_id_signage_slides_id_fk" FOREIGN KEY ("quake_slides_calm_id") REFERENCES "public"."signage_slides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signage_groups" ADD CONSTRAINT "signage_groups_quake_slides_evacuate_id_signage_slides_id_fk" FOREIGN KEY ("quake_slides_evacuate_id") REFERENCES "public"."signage_slides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "signage_groups" ADD CONSTRAINT "signage_groups_quake_slides_cancelled_id_signage_slides_id_fk" FOREIGN KEY ("quake_slides_cancelled_id") REFERENCES "public"."signage_slides"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "signage_groups_quake_slides_quake_slides_warning_idx" ON "signage_groups" USING btree ("quake_slides_warning_id");
  CREATE INDEX "signage_groups_quake_slides_quake_slides_calm_idx" ON "signage_groups" USING btree ("quake_slides_calm_id");
  CREATE INDEX "signage_groups_quake_slides_quake_slides_evacuate_idx" ON "signage_groups" USING btree ("quake_slides_evacuate_id");
  CREATE INDEX "signage_groups_quake_slides_quake_slides_cancelled_idx" ON "signage_groups" USING btree ("quake_slides_cancelled_id");
  INSERT INTO "signage_groups" ("name", "visible", "is_all", "is_quake", "updated_at", "created_at")
    VALUES ('緊急地震速報', false, false, true, now(), now());`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "signage_groups" WHERE "is_quake" = true;
   ALTER TABLE "signage_groups" DROP CONSTRAINT "signage_groups_quake_slides_warning_id_signage_slides_id_fk";
  
  ALTER TABLE "signage_groups" DROP CONSTRAINT "signage_groups_quake_slides_calm_id_signage_slides_id_fk";
  
  ALTER TABLE "signage_groups" DROP CONSTRAINT "signage_groups_quake_slides_evacuate_id_signage_slides_id_fk";
  
  ALTER TABLE "signage_groups" DROP CONSTRAINT "signage_groups_quake_slides_cancelled_id_signage_slides_id_fk";
  
  DROP INDEX "signage_groups_quake_slides_quake_slides_warning_idx";
  DROP INDEX "signage_groups_quake_slides_quake_slides_calm_idx";
  DROP INDEX "signage_groups_quake_slides_quake_slides_evacuate_idx";
  DROP INDEX "signage_groups_quake_slides_quake_slides_cancelled_idx";
  ALTER TABLE "signage_groups" DROP COLUMN "is_quake";
  ALTER TABLE "signage_groups" DROP COLUMN "quake_slides_warning_id";
  ALTER TABLE "signage_groups" DROP COLUMN "quake_slides_calm_id";
  ALTER TABLE "signage_groups" DROP COLUMN "quake_slides_evacuate_id";
  ALTER TABLE "signage_groups" DROP COLUMN "quake_slides_cancelled_id";`)
}
