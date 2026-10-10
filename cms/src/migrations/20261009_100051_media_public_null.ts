import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// スキーマ変更なし。used_in_published の三値化 (NULL=公開判定の対象外で常に公開) に合わせたデータ移行。
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 旧条件では所有者ありの NULL は非公開だった。NULL を常に公開と読み替えると公開されてしまうため false に固定する
    UPDATE "media" SET "used_in_published" = false
    WHERE "used_in_published" IS NULL AND "owner_id" IS NOT NULL;

    UPDATE "media" m SET "used_in_published" = NULL
    FROM "users" u
    WHERE u."id" = m."owner_id" AND u."role" = 'executive';
  `)
}

// 実行委員所有の行は「使用中 (true)」だったものも false に戻る。次回の企画保存時の同期で再計算される。
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "media" SET "used_in_published" = false
    WHERE "used_in_published" IS NULL AND "owner_id" IS NOT NULL;
  `)
}
