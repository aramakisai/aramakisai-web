import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" ADD COLUMN "embed_url" varchar;
  ALTER TABLE "topics" ADD COLUMN "embed_height" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "topics" DROP COLUMN "embed_url";
  ALTER TABLE "topics" DROP COLUMN "embed_height";`)
}
