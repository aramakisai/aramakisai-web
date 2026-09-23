import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_map_areas_color" AS ENUM('primary', 'secondary', 'accent', 'accent-alt', 'info', 'success', 'warning');
  ALTER TABLE "map_areas" ADD COLUMN "color" "enum_map_areas_color";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "map_areas" DROP COLUMN "color";
  DROP TYPE "public"."enum_map_areas_color";`)
}
