import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import * as migration from '../src/migrations/20261028_040027_regional_sponsor_map_schema'

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!hasDatabase)('regional sponsor map migration integration', () => {
  it('既存Sponsorを保ったままdown/upを往復する', async () => {
    const { getPayload } = await import('payload')
    const config = (await import('../src/payload.config')).default
    const payload = await getPayload({ config })
    const transactionID = (await payload.db.beginTransaction()) as string | number
    const sessions = payload.db as unknown as {
      sessions: Record<
        string | number,
        {
          db: {
            execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }>
          }
        }
      >
    }
    const db = sessions.sessions[transactionID].db
    const req = { transactionID }
    const args = { db, payload, req } as never

    try {
      await migration.down(args)
      const [{ id }] = (
        await db.execute(sql`
          INSERT INTO "sponsors" ("name", "updated_at", "created_at")
          VALUES ('migration fixture', now(), now()) RETURNING "id";
        `)
      ).rows
      await db.execute(sql`
        INSERT INTO "sponsors_type" ("order", "parent_id", "value")
        VALUES (1, ${id as number}, 'local');
      `)
      const [{ id: existingAdId }] = (
        await db.execute(sql`
          INSERT INTO "sponsors" ("name", "updated_at", "created_at")
          VALUES ('existing ad fixture', now(), now()) RETURNING "id";
        `)
      ).rows
      await db.execute(sql`
        INSERT INTO "sponsors_type" ("order", "parent_id", "value")
        VALUES (1, ${existingAdId as number}, 'ad');
      `)

      await migration.up(args)
      const [migrated] = (
        await db.execute(sql`
          SELECT "name", "business_category",
                 "local_latitude", "local_longitude", "local_image_id"
          FROM "sponsors" WHERE "id" = ${id as number};
        `)
      ).rows
      expect(migrated).toEqual({
        name: 'migration fixture',
        business_category: null,
        local_latitude: null,
        local_longitude: null,
        local_image_id: null,
      })
      const [existingAd] = (
        await db.execute(sql`
          SELECT "sponsors"."name", "sponsors_type"."value" AS "type"
          FROM "sponsors"
          INNER JOIN "sponsors_type" ON "sponsors_type"."parent_id" = "sponsors"."id"
          WHERE "sponsors"."id" = ${existingAdId as number};
        `)
      ).rows
      expect(existingAd).toEqual({ name: 'existing ad fixture', type: 'ad' })
      await migration.down(args)
      const [{ count }] = (
        await db.execute(sql`
          SELECT count(*)::int AS count FROM information_schema.columns
          WHERE table_name = 'sponsors' AND column_name LIKE 'local_%';
        `)
      ).rows
      expect(count).toBe(0)
    } finally {
      try {
        await payload.db.rollbackTransaction(transactionID)
      } finally {
        await payload.destroy()
      }
    }
  })
})
