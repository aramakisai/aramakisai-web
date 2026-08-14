/**
 * topics へ追加した published_at フィールドに合わせ、PUBLIC の topics read 権限へ
 * announcements と同じ公開日時フィルタ (published_at <= $NOW かつ非NULL) を付与する。
 * これにより公開前 (published_at が未来またはNULL) の topics は一覧取得で非表示になる。
 *
 * 既存の PUBLIC topics read permission (permissions: {}) を対象に更新するため、
 * 冪等性は「対象行が存在すれば permissions を上書きする」形で確保する
 * (delete-then-insert ではなく update: fields="*" 等の他カラムを保持するため)。
 *
 * 適用後は権限キャッシュが更新されないため Directus の再起動が必要。
 */

const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";
const PUBLISHED_FILTER = { published_at: { _lte: "$NOW", _nnull: true } };

export async function up(knex) {
  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "topics")
    .andWhere("action", "read")
    .update({ permissions: PUBLISHED_FILTER });
}

export async function down(knex) {
  await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "topics")
    .andWhere("action", "read")
    .update({ permissions: {} });
}
