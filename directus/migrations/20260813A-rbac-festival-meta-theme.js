/**
 * festival_meta へ追加した theme_word / theme_image / theme_description /
 * venue_name / campus_map_url / contact_form_url の公開読み取り権限を付与する。
 *
 * PUBLIC の festival_meta read 権限は fields が "*" (ワイルドカード) の場合と
 * 個別フィールドリストの場合があるため、ワイルドカードなら変更せず、
 * 個別リストの場合のみ新規フィールド名を追加する (delete-then-insert で
 * 総入れ替えすると意図しないフィールドまで公開範囲が広がる恐れがあるため)。
 *
 * theme_image は directus_files への参照。既存の PUBLIC directus_files read
 * 権限 (fields: "*") が既にあれば追加不要、なければ hero_image と同じ形で作成する。
 *
 * 適用後は権限キャッシュが更新されないため Directus の再起動が必要。
 */

const PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17";
const NEW_FIELDS = [
  "theme_word",
  "theme_image",
  "theme_description",
  "venue_name",
  "campus_map_url",
  "contact_form_url",
];

export async function up(knex) {
  // ── (a) festival_meta: PUBLIC read の fields へ新規フィールドを追加 ──
  const festivalMetaPerm = await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "festival_meta")
    .andWhere("action", "read")
    .first();

  if (festivalMetaPerm) {
    const currentFields = festivalMetaPerm.fields ? festivalMetaPerm.fields.split(",") : [];
    if (!currentFields.includes("*")) {
      const merged = Array.from(new Set([...currentFields, ...NEW_FIELDS]));
      await knex("directus_permissions")
        .where("id", festivalMetaPerm.id)
        .update({ fields: merged.join(",") });
    }
  } else {
    await knex("directus_permissions").insert({
      policy: PUBLIC_POLICY_ID,
      collection: "festival_meta",
      action: "read",
      permissions: JSON.stringify({}),
      validation: null,
      presets: null,
      fields: NEW_FIELDS.join(","),
    });
  }

  // ── (b) directus_files: theme_image 用の PUBLIC read (なければ作成) ──
  const filesPerm = await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "directus_files")
    .andWhere("action", "read")
    .first();

  if (!filesPerm) {
    await knex("directus_permissions").insert({
      policy: PUBLIC_POLICY_ID,
      collection: "directus_files",
      action: "read",
      permissions: JSON.stringify({}),
      validation: null,
      presets: null,
      fields: "*",
    });
  }
}

export async function down(knex) {
  // up で追加した festival_meta の新規フィールド名のみを取り消す
  // (ワイルドカードだった場合は up で変更していないため、down でも変更しない)
  const festivalMetaPerm = await knex("directus_permissions")
    .where("policy", PUBLIC_POLICY_ID)
    .andWhere("collection", "festival_meta")
    .andWhere("action", "read")
    .first();

  if (festivalMetaPerm) {
    const currentFields = festivalMetaPerm.fields ? festivalMetaPerm.fields.split(",") : [];
    if (!currentFields.includes("*")) {
      const reverted = currentFields.filter((field) => !NEW_FIELDS.includes(field));
      await knex("directus_permissions")
        .where("id", festivalMetaPerm.id)
        .update({ fields: reverted.join(",") });
    }
  }
}
