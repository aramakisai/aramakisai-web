/**
 * topics_filesとannouncements_filesに対するRBAC権限を追加します。
 * EXECUTIVEにはCRUD権限を、PUBLICにはRead権限を付与します。
 */

const EXECUTIVE_POLICY_ID = "5001c2e1-4050-4655-88b2-34a444345504";
const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────

  await knex("directus_permissions")
    .where("policy", EXECUTIVE_POLICY_ID)
    .whereIn("collection", ["topics_files", "announcements_files"])
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", ["topics_files", "announcements_files"])
    .delete();

  const collections = ["topics_files", "announcements_files"];

  // (a) topics_files, announcements_files に対する EXECUTIVE 権限 (CRUD)
  const executivePerms = collections.flatMap((collection) =>
    ["create", "read", "update", "delete"].map((action) => ({
      policy: EXECUTIVE_POLICY_ID,
      collection,
      action,
      permissions: {},
      validation: null,
      presets: null,
      fields: "*",
    }))
  );
  await knex("directus_permissions").insert(executivePerms);

  // (b) topics_files, announcements_files に対する PUBLIC 権限 (Read)
  const publicPerms = collections.map((collection) => ({
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
    .where("policy", EXECUTIVE_POLICY_ID)
    .whereIn("collection", ["topics_files", "announcements_files"])
    .delete();

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", ["topics_files", "announcements_files"])
    .delete();
}
