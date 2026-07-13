/**
 * Home Pageが公開APIとして参照するがPUBLIC権限が未付与だったcollectionを追加します。
 *
 * - sponsors: getHomePage()が無条件でreadItems('sponsors')を呼ぶため、
 *   PUBLIC readが無いと匿名アクセス時に403で例外が発生し、
 *   Home Page全体がフォールバック表示 (荒牧祭の見出しのみ) になってしまう。
 * - directus_files: hero_image/topics.image/sponsors.logo等が参照するファイル実体。
 *   collection自体へのPUBLIC readが無いと /assets/<id> が403になり、
 *   画像が一切表示されない (executive/student_exhibitorへのfileライブラリ権限追加
 *   (#39) はUpload用であり、PUBLIC read とは無関係)。
 */

const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";
const PUBLIC_COLLECTIONS = ["sponsors", "directus_files"];

export async function up(knex) {
  // ── Permissions: delete-then-insert で冪等性確保 ─────────────

  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .whereIn("collection", PUBLIC_COLLECTIONS)
    .delete();

  const publicPerms = PUBLIC_COLLECTIONS.map((collection) => ({
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
    .whereIn("collection", PUBLIC_COLLECTIONS)
    .delete();
}
