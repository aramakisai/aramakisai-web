const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";

const STATIC_PAGE_COLLECTIONS = ["page_access", "page_contact", "page_privacy"];

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────
  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", STATIC_PAGE_COLLECTIONS)
    .delete();

  // page_access / page_contact / page_privacy に対する PUBLIC 権限 (Read)
  const publicPerms = STATIC_PAGE_COLLECTIONS.map((collection) => ({
    policy: PUBLIC_POLICY_ID,
    collection,
    action: "read",
    permissions: {},
    validation: null,
    presets: null,
    fields: "*",
  }));
  await knex("directus_permissions").insert(publicPerms);
}

export async function down(knex) {
  // up関数で追加した permission のみを削除する
  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", STATIC_PAGE_COLLECTIONS)
    .delete();
}
