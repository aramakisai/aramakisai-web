import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "performance_slots" ADD COLUMN "event_date" timestamp(3) with time zone;
  ALTER TABLE "performance_slots" ADD COLUMN "start_at" timestamp(3) with time zone;
  ALTER TABLE "performance_slots" ADD COLUMN "end_at" timestamp(3) with time zone;

  UPDATE "performance_slots" ps
  SET "start_at" = ts."start_at", "end_at" = ts."end_at"
  FROM "time_slots" ts
  WHERE ts."id" = ps."time_slot_id_id";

  UPDATE "performance_slots"
  SET "event_date" = (
    SELECT date_trunc('day', min(d."start_at") AT TIME ZONE 'Asia/Tokyo') + interval '12 hours'
    FROM "festival_meta_event_days" d
  ) AT TIME ZONE 'UTC';

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM "performance_slots"
      WHERE "event_date" IS NULL OR "start_at" IS NULL OR "end_at" IS NULL
    ) THEN
      RAISE EXCEPTION '出演枠の開催日・時刻を設定できない。祭基本情報に開催日程を登録してから再実行する';
    END IF;
  END $$;

  ALTER TABLE "performance_slots" ALTER COLUMN "event_date" SET NOT NULL;
  ALTER TABLE "performance_slots" ALTER COLUMN "start_at" SET NOT NULL;
  ALTER TABLE "performance_slots" ALTER COLUMN "end_at" SET NOT NULL;

  ALTER TABLE "performance_slots" DROP CONSTRAINT "performance_slots_stage_time_slot_unique";
  ALTER TABLE "performance_slots" DROP CONSTRAINT "performance_slots_time_slot_id_id_time_slots_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_time_slots_fk";
  DROP INDEX "performance_slots_time_slot_id_idx";
  DROP INDEX "payload_locked_documents_rels_time_slots_id_idx";
  ALTER TABLE "performance_slots" DROP COLUMN "time_slot_id_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "time_slots_id";
  ALTER TABLE "time_slots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "time_slots" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "time_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"start_at" timestamp(3) with time zone NOT NULL,
  	"end_at" timestamp(3) with time zone NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "performance_slots" ADD COLUMN "time_slot_id_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "time_slots_id" integer;

  DO $$
  DECLARE
    r record;
    sid integer;
  BEGIN
    FOR r IN SELECT "id", "start_at", "end_at" FROM "performance_slots" LOOP
      INSERT INTO "time_slots" ("label", "start_at", "end_at")
      VALUES (
        to_char(r."start_at" AT TIME ZONE 'Asia/Tokyo', 'HH24:MI') || '〜' || to_char(r."end_at" AT TIME ZONE 'Asia/Tokyo', 'HH24:MI'),
        r."start_at",
        r."end_at"
      )
      RETURNING "id" INTO sid;
      UPDATE "performance_slots" SET "time_slot_id_id" = sid WHERE "id" = r."id";
    END LOOP;
  END $$;

  ALTER TABLE "performance_slots" ALTER COLUMN "time_slot_id_id" SET NOT NULL;
  CREATE INDEX "time_slots_updated_at_idx" ON "time_slots" USING btree ("updated_at");
  CREATE INDEX "time_slots_created_at_idx" ON "time_slots" USING btree ("created_at");
  ALTER TABLE "performance_slots" ADD CONSTRAINT "performance_slots_time_slot_id_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id_id") REFERENCES "public"."time_slots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_time_slots_fk" FOREIGN KEY ("time_slots_id") REFERENCES "public"."time_slots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "performance_slots_time_slot_id_idx" ON "performance_slots" USING btree ("time_slot_id_id");
  CREATE INDEX "payload_locked_documents_rels_time_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("time_slots_id");
  ALTER TABLE "performance_slots" ADD CONSTRAINT "performance_slots_stage_time_slot_unique" UNIQUE ("stage_id_id", "time_slot_id_id");
  ALTER TABLE "performance_slots" DROP COLUMN "event_date";
  ALTER TABLE "performance_slots" DROP COLUMN "start_at";
  ALTER TABLE "performance_slots" DROP COLUMN "end_at";`)
}
