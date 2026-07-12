const EXECUTIVE_POLICY_ID = "5001c2e1-4050-4655-88b2-34a444345504";
const STUDENT_EXHIBITOR_POLICY_ID = "40bfc0da-e037-4df3-a0c4-00584bf6c9a5";
const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────

  await knex("directus_permissions")
    .where("policy", EXECUTIVE_POLICY_ID)
    .andWhere("collection", "page_home_live")
    .delete();

  await knex("directus_permissions")
    .where("policy", STUDENT_EXHIBITOR_POLICY_ID)
    .andWhere("collection", "page_home_live")
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", ["page_home", "page_home_live", "festival_meta", "announcements", "topics"])
    .delete();

  // (a) page_home_live に対する EXECUTIVE 権限 (CRUD)
  const executivePerms = ["create", "read", "update", "delete"].map((action) => ({
    policy: EXECUTIVE_POLICY_ID,
    collection: "page_home_live",
    action,
    permissions: {},
    validation: null,
    presets: null,
    fields: "*",
  }));
  await knex("directus_permissions").insert(executivePerms);

  // (b) page_home_live に対する STUDENT_EXHIBITOR 権限 (Read)
  await knex("directus_permissions").insert({
    policy: STUDENT_EXHIBITOR_POLICY_ID,
    collection: "page_home_live",
    action: "read",
    permissions: {},
    validation: null,
    presets: null,
    fields: "*",
  });

  // (c) 5コレクションに対する PUBLIC 権限 (Read)
  const publicCollections = ["page_home", "page_home_live", "festival_meta", "announcements", "topics"];
  const publicPerms = publicCollections.map((collection) => {
    let permissions = {};
    if (collection === "announcements") {
      permissions = { published_at: { _lte: "$NOW", _nnull: true } };
    }
    return {
      policy: PUBLIC_POLICY_ID,
      collection,
      action: "read",
      permissions,
      validation: null,
      presets: null,
      fields: "*",
    };
  });
  await knex("directus_permissions").insert(publicPerms);
}

export async function down(knex) {
  // up関数で追加した permission のみを削除する

  await knex("directus_permissions")
    .where("policy", EXECUTIVE_POLICY_ID)
    .andWhere("collection", "page_home_live")
    .delete();

  await knex("directus_permissions")
    .where("policy", STUDENT_EXHIBITOR_POLICY_ID)
    .andWhere("collection", "page_home_live")
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", ["page_home", "page_home_live", "festival_meta", "announcements", "topics"])
    .delete();
}
