/**
 * Tasks 2.2, 3.1: composite UNIQUE constraints
 * (area_id, booth_number) on student_exhibitions and sponsors
 * These cannot be expressed in Directus schema snapshot.
 */
export async function up(knex) {
  // student_exhibitions: (area_id, booth_number) unique where both are NOT NULL
  await knex.raw(`
    CREATE UNIQUE INDEX student_exhibitions_area_booth_unique
    ON student_exhibitions (area_id, booth_number)
    WHERE area_id IS NOT NULL AND booth_number IS NOT NULL
  `);

  // sponsors: (area_id, booth_number) unique where both are NOT NULL
  await knex.raw(`
    CREATE UNIQUE INDEX sponsors_area_booth_unique
    ON sponsors (area_id, booth_number)
    WHERE area_id IS NOT NULL AND booth_number IS NOT NULL
  `);
}

export async function down(knex) {
  await knex.raw(
    "DROP INDEX IF EXISTS student_exhibitions_area_booth_unique"
  );
  await knex.raw("DROP INDEX IF EXISTS sponsors_area_booth_unique");
}
