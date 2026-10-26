import { sql } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import * as migration from '../src/migrations/20261025_160749_regional_sponsor_map_schema'

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
          SELECT "name", "local_import_id", "local_map_category",
                 "local_latitude", "local_longitude", "local_image_id"
          FROM "sponsors" WHERE "id" = ${id as number};
        `)
      ).rows
      expect(migrated).toEqual({
        name: 'migration fixture',
        local_import_id: null,
        local_map_category: null,
        local_latitude: null,
        local_longitude: null,
        local_image_id: null,
      })
      const constraints = (
        await db.execute(sql`
          SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname IN ('sponsors_local_latitude_check', 'sponsors_local_longitude_check')
          ORDER BY conname;
        `)
      ).rows
      expect(constraints).toEqual([
        {
          conname: 'sponsors_local_latitude_check',
          definition: expect.stringMatching(/local_latitude.*-90.*90/),
        },
        {
          conname: 'sponsors_local_longitude_check',
          definition: expect.stringMatching(/local_longitude.*-180.*180/),
        },
      ])
      const [existingAd] = (
        await db.execute(sql`
          SELECT "sponsors"."name", "sponsors_type"."value" AS "type"
          FROM "sponsors"
          INNER JOIN "sponsors_type" ON "sponsors_type"."parent_id" = "sponsors"."id"
          WHERE "sponsors"."id" = ${existingAdId as number};
        `)
      ).rows
      expect(existingAd).toEqual({ name: 'existing ad fixture', type: 'ad' })
      const [{ count: thumbnailColumnCount }] = (
        await db.execute(sql`
          SELECT count(*)::int AS count FROM information_schema.columns
          WHERE table_name = 'media' AND column_name LIKE 'sizes_thumbnail_%';
        `)
      ).rows
      expect(thumbnailColumnCount).toBe(6)

      await migration.down(args)
      const [{ count }] = (
        await db.execute(sql`
          SELECT count(*)::int AS count FROM information_schema.columns
          WHERE table_name = 'sponsors' AND column_name LIKE 'local_%';
        `)
      ).rows
      expect(count).toBe(0)
      const [{ count: thumbnailColumnCountAfterDown }] = (
        await db.execute(sql`
          SELECT count(*)::int AS count FROM information_schema.columns
          WHERE table_name = 'media' AND column_name LIKE 'sizes_thumbnail_%';
        `)
      ).rows
      expect(thumbnailColumnCountAfterDown).toBe(0)
    } finally {
      try {
        await payload.db.rollbackTransaction(transactionID)
      } finally {
        await payload.destroy()
      }
    }
  })
})
