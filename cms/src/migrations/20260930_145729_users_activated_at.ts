import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 招待送信で期限が「発行+72時間」に設定される。resetPassword 成功 (期限を現在時刻へ) や
// forgot-password 申請 (期限を再設定) があれば値がずれるため、ずれた人を設定済みとみなす。
// forgot 申請だけして未設定の人が済み扱いになる誤判定は許容する (自力で設定できる)。
// 許容幅 10 分は送信遅延の吸収。
export const backfillActivatedAt = sql`
  UPDATE "users" SET "activated_at" = now()
  WHERE "role" = 'student_exhibitor'
    AND "invite_status" = 'sent'
    AND "invite_sent_at" IS NOT NULL
    AND "activated_at" IS NULL
    AND ("reset_password_expiration" IS NULL
      OR abs(extract(epoch FROM "reset_password_expiration" - ("invite_sent_at" + interval '72 hours'))) > 600)`

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "activated_at" timestamp(3) with time zone;`)
  await db.execute(backfillActivatedAt)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "activated_at";`)
}
