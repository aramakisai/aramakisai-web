/**
 * page_home_live廃止 (page_homeへの一本化) に伴い、
 * 20260712A-rbac-page-home-live.jsで付与したpage_home_live宛て権限を無効化する。
 * page_home_live collection自体はsnapshot適用で削除されるため、権限行のみを対象に削除する。
 */

const EXECUTIVE_POLICY_ID = "5001c2e1-4050-4655-88b2-34a444345504";
const STUDENT_EXHIBITOR_POLICY_ID = "40bfc0da-e037-4df3-a0c4-00584bf6c9a5";
const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";

export async function up(knex) {
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
    .andWhere("collection", "page_home_live")
    .delete();
}

export async function down(knex) {
  // page_home_live collection自体がsnapshot適用で削除されるため、権限の復元はできない。
}
