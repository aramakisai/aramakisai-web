import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload のコレクション定義では表現できない DB 制約。
 * 現行 Directus の custom migration (performance-slots-check / composite-unique-constraints) と同等。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "performance_slots"
    ADD CONSTRAINT "performance_slots_stage_time_slot_unique"
    UNIQUE ("stage_id_id", "time_slot_id_id");

    ALTER TABLE "performance_slots"
    ADD CONSTRAINT "performance_slots_exhibition_or_title_required"
    CHECK ("exhibition_id_id" IS NOT NULL OR "title" IS NOT NULL);

    CREATE UNIQUE INDEX "student_exhibitions_area_booth_unique"
    ON "student_exhibitions" ("area_id_id", "booth_number")
    WHERE "area_id_id" IS NOT NULL AND "booth_number" IS NOT NULL;

    CREATE UNIQUE INDEX "sponsors_area_booth_unique"
    ON "sponsors" ("area_id_id", "booth_number")
    WHERE "area_id_id" IS NOT NULL AND "booth_number" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "sponsors_area_booth_unique";
    DROP INDEX IF EXISTS "student_exhibitions_area_booth_unique";
    ALTER TABLE "performance_slots" DROP CONSTRAINT IF EXISTS "performance_slots_exhibition_or_title_required";
    ALTER TABLE "performance_slots" DROP CONSTRAINT IF EXISTS "performance_slots_stage_time_slot_unique";
  `)
}
