/**
 * pagesコレクションへの統合に伴い廃止する旧4シングルトン
 * (page_privacy/page_contact/page_access/page_sponsor_guide) に紐づく
 * 権限行を、ポリシー種別を問わず一括削除する。
 * (Admin UI経由で個別に付与された行を含め、collection名で網羅的に削除する)
 */

const LEGACY_COLLECTIONS = [
  "page_privacy",
  "page_contact",
  "page_access",
  "page_sponsor_guide",
];

export async function up(knex) {
  await knex("directus_permissions")
    .whereIn("collection", LEGACY_COLLECTIONS)
    .delete();
}

export async function down(knex) {
  // 旧collection自体がsnapshot適用で削除されるため、権限の復元はできない。
}
