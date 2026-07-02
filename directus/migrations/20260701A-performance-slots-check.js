/**
 * Task 4.3: performance_slots の CHECK 制約
 * exhibition_id か title の少なくとも一方が必須 (両方 NULL は不可)
 * Directus schema snapshot は CHECK 制約非対応のため custom migration で担保する
 */
export async function up(knex) {
  await knex.schema.table("performance_slots", (table) => {
    table.unique(["stage_id", "time_slot_id"], {
      indexName: "performance_slots_stage_id_time_slot_id_unique",
    });
  });

  await knex.raw(`
    ALTER TABLE performance_slots
    ADD CONSTRAINT performance_slots_exhibition_or_title_required
    CHECK (exhibition_id IS NOT NULL OR title IS NOT NULL)
  `);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE performance_slots
    DROP CONSTRAINT IF EXISTS performance_slots_exhibition_or_title_required
  `);

  await knex.schema.table("performance_slots", (table) => {
    table.dropUnique(
      ["stage_id", "time_slot_id"],
      "performance_slots_stage_id_time_slot_id_unique"
    );
  });
}
