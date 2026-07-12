/**
 * Task 6.1/6.2 補完: 20260701C-rbac-roles.js の ALL_COLLECTIONS が
 * コンテンツ collection のみを対象としており、system collection である
 * directus_files / directus_folders への権限付与が漏れていた。
 * executive / student_exhibitor どちらも画像アップロードが一切できない不具合の修正。
 */

const EXECUTIVE_POLICY_ID = "5001c2e1-4050-4655-88b2-34a444345504";
const STUDENT_EXHIBITOR_POLICY_ID = "40bfc0da-e037-4df3-a0c4-00584bf6c9a5";

const FILE_COLLECTIONS = ["directus_files", "directus_folders"];

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────
  await knex("directus_permissions")
    .whereIn("policy", [EXECUTIVE_POLICY_ID, STUDENT_EXHIBITOR_POLICY_ID])
    .whereIn("collection", FILE_COLLECTIONS)
    .delete();

  // executive: ファイルライブラリ CRUD (CMS運用上、画像・PDF等を自由に管理する必要がある)
  const executivePerms = FILE_COLLECTIONS.flatMap((collection) =>
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

  // student_exhibitor: 自団体の images フィールド用にアップロード(create)・閲覧(read)のみ
  const studentPerms = [
    {
      policy: STUDENT_EXHIBITOR_POLICY_ID,
      collection: "directus_files",
      action: "create",
      permissions: {},
      validation: null,
      presets: null,
      fields: "*",
    },
    {
      policy: STUDENT_EXHIBITOR_POLICY_ID,
      collection: "directus_files",
      action: "read",
      permissions: {},
      validation: null,
      presets: null,
      fields: "*",
    },
    {
      policy: STUDENT_EXHIBITOR_POLICY_ID,
      collection: "directus_folders",
      action: "read",
      permissions: {},
      validation: null,
      presets: null,
      fields: "*",
    },
  ];
  await knex("directus_permissions").insert(studentPerms);
}

export async function down(knex) {
  await knex("directus_permissions")
    .whereIn("policy", [EXECUTIVE_POLICY_ID, STUDENT_EXHIBITOR_POLICY_ID])
    .whereIn("collection", FILE_COLLECTIONS)
    .delete();
}
