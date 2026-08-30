import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "student_exhibitions_owner_idx";
  CREATE UNIQUE INDEX "student_exhibitions_owner_idx" ON "student_exhibitions" USING btree ("owner_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "student_exhibitions_owner_idx";
  CREATE INDEX "student_exhibitions_owner_idx" ON "student_exhibitions" USING btree ("owner_id");`)
}
