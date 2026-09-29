import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "map_areas" ALTER COLUMN "color" TYPE varchar USING (
    CASE "color"::text
      WHEN 'primary' THEN '#ebb03c'
      WHEN 'secondary' THEN '#7fc8ad'
      WHEN 'accent' THEN '#ee7e84'
      WHEN 'accent-alt' THEN '#a18abf'
      WHEN 'info' THEN '#80c1c6'
      WHEN 'success' THEN '#8cb76b'
      WHEN 'warning' THEN '#e86f30'
      ELSE NULL
    END
   );
  DROP TYPE "public"."enum_map_areas_color";

  UPDATE "map_areas"
  SET "geometry" = jsonb_build_object('type', 'MultiPolygon', 'coordinates', jsonb_build_array("geometry"->'coordinates'))
  WHERE "geometry"->>'type' = 'Polygon';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "map_areas"
  SET "geometry" = jsonb_build_object('type', 'Polygon', 'coordinates', "geometry"->'coordinates'->0)
  WHERE "geometry"->>'type' = 'MultiPolygon';

  CREATE TYPE "public"."enum_map_areas_color" AS ENUM('primary', 'secondary', 'accent', 'accent-alt', 'info', 'success', 'warning');

  ALTER TABLE "map_areas" ALTER COLUMN "color" TYPE "public"."enum_map_areas_color" USING (
    CASE lower("color")
      WHEN '#ebb03c' THEN 'primary'
      WHEN '#7fc8ad' THEN 'secondary'
      WHEN '#ee7e84' THEN 'accent'
      WHEN '#a18abf' THEN 'accent-alt'
      WHEN '#80c1c6' THEN 'info'
      WHEN '#8cb76b' THEN 'success'
      WHEN '#e86f30' THEN 'warning'
      ELSE NULL
    END
  )::"public"."enum_map_areas_color";`)
}
