/**
 * 新設pagesコレクション(固定ページ統合用)に対するRBAC権限を追加します。
 * EXECUTIVEにはCRUD権限を、PUBLICにはRead権限を付与します。
 */

const EXECUTIVE_POLICY_ID = "5001c2e1-4050-4655-88b2-34a444345504";
const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────

  await knex("directus_permissions")
    .where("policy", EXECUTIVE_POLICY_ID)
    .andWhere("collection", "pages")
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "pages")
    .delete();

  // (a) pages に対する EXECUTIVE 権限 (CRUD)
  const executivePerms = ["create", "read", "update", "delete"].map((action) => ({
    policy: EXECUTIVE_POLICY_ID,
    collection: "pages",
    action,
    permissions: {},
    validation: null,
    presets: null,
    fields: "*",
  }));
  await knex("directus_permissions").insert(executivePerms);

  // (b) pages に対する PUBLIC 権限 (Read)
  await knex("directus_permissions").insert({
    policy: PUBLIC_POLICY_ID,
    collection: "pages",
    action: "read",
    permissions: {},
    validation: null,
    presets: null,
    fields: "*",
  });
}

export async function down(knex) {
  // up関数で追加した permission のみを削除する

  await knex("directus_permissions")
    .where("policy", EXECUTIVE_POLICY_ID)
    .andWhere("collection", "pages")
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "pages")
    .delete();
}
