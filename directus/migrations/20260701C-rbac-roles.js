/**
 * Tasks 6.1, 6.2: RBAC ロール定義
 * - executive: 全コレクション CRUD (superadmin とは別ロール)
 * - student_exhibitor: student_exhibitions の自レコードのみ編集、他は published READ のみ
 *
 * Task 6.3 (Authentik OIDC マッピング) は aramakisai-infra で管理。
 */

const EXECUTIVE_ROLE_ID = "65869bf1-6622-4bab-8aec-785d0db2c32a";
const STUDENT_EXHIBITOR_ROLE_ID = "49c93d00-c61f-418b-a1db-5118260f4667";

const ALL_COLLECTIONS = [
  "map_areas",
  "time_slots",
  "student_exhibitions",
  "sponsors",
  "stages",
  "performance_slots",
  "announcements",
  "faq_items",
  "topics",
  "festival_meta",
  "page_home",
  "page_access",
  "page_contact",
];

// Collections student_exhibitor can READ (published only)
const PUBLIC_COLLECTIONS = [
  "map_areas",
  "time_slots",
  "student_exhibitions",
  "sponsors",
  "stages",
  "performance_slots",
  "announcements",
  "faq_items",
  "topics",
  "festival_meta",
  "page_home",
  "page_access",
  "page_contact",
];

// Fields student_exhibitor can UPDATE on student_exhibitions
const STUDENT_UPDATABLE_FIELDS = [
  "name",
  "slug",
  "description",
  "content",
  "images",
  "status",
];

export async function up(knex) {
  // ── Roles ──────────────────────────────────────────────────────
  await knex("directus_roles").insert([
    {
      id: EXECUTIVE_ROLE_ID,
      name: "executive",
      icon: "verified",
      description: "荒牧祭実行委員。全コレクション管理権限。",
      ip_access: null,
      enforce_tfa: false,
      admin_access: false,
      app_access: true,
    },
    {
      id: STUDENT_EXHIBITOR_ROLE_ID,
      name: "student_exhibitor",
      icon: "school",
      description: "学生団体担当者。自団体レコードのみ編集。",
      ip_access: null,
      enforce_tfa: false,
      admin_access: false,
      app_access: true,
    },
  ]);

  // ── executive: CRUD on all collections ────────────────────────
  const executivePerms = ALL_COLLECTIONS.flatMap((collection) =>
    ["create", "read", "update", "delete"].map((action) => ({
      role: EXECUTIVE_ROLE_ID,
      collection,
      action,
      permissions: {},
      validation: null,
      presets: null,
      fields: ["*"],
    }))
  );
  await knex("directus_permissions").insert(executivePerms);

  // ── student_exhibitor: CREATE on student_exhibitions ──────────
  await knex("directus_permissions").insert({
    role: STUDENT_EXHIBITOR_ROLE_ID,
    collection: "student_exhibitions",
    action: "create",
    permissions: {},
    validation: null,
    presets: null,
    fields: STUDENT_UPDATABLE_FIELDS,
  });

  // ── student_exhibitor: UPDATE own record only ─────────────────
  await knex("directus_permissions").insert({
    role: STUDENT_EXHIBITOR_ROLE_ID,
    collection: "student_exhibitions",
    action: "update",
    permissions: { user_created: { _eq: "$CURRENT_USER" } },
    validation: null,
    presets: null,
    fields: STUDENT_UPDATABLE_FIELDS,
  });

  // ── student_exhibitor: READ published only (all public collections)
  const readPerms = PUBLIC_COLLECTIONS.map((collection) => {
    const isStatusCollection = collection === "student_exhibitions";
    const isPublishedAt = collection === "announcements";
    let permissions = {};

    if (isStatusCollection) {
      permissions = { status: { _eq: "published" } };
    } else if (isPublishedAt) {
      permissions = {
        published_at: { _lte: "$NOW", _nnull: true },
      };
    }

    return {
      role: STUDENT_EXHIBITOR_ROLE_ID,
      collection,
      action: "read",
      permissions,
      validation: null,
      presets: null,
      fields: ["*"],
    };
  });
  await knex("directus_permissions").insert(readPerms);
}

export async function down(knex) {
  await knex("directus_permissions")
    .whereIn("role", [EXECUTIVE_ROLE_ID, STUDENT_EXHIBITOR_ROLE_ID])
    .delete();

  await knex("directus_roles")
    .whereIn("id", [EXECUTIVE_ROLE_ID, STUDENT_EXHIBITOR_ROLE_ID])
    .delete();
}
