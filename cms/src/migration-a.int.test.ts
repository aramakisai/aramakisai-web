import { sql } from '@payloadcms/db-postgres';
import { describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

type Row = Record<string, unknown>;

// 適用済みの DB でマイグレーションAを down → 旧データ投入 → up し、検証後にロールバックする。
// トランザクションに閉じるため、他の統合テストのデータには触れない。
async function withOldSchema(
  run: (ctx: {
    payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
    req: { transactionID: string | number };
    q: (query: ReturnType<typeof sql>) => Promise<Row[]>;
    up: () => Promise<void>;
    down: () => Promise<void>;
  }) => Promise<void>,
) {
  const { getPayload } = await import('payload');
  const config = (await import('./payload.config')).default;
  const payload = await getPayload({ config });
  const mig = await import('./migrations/20261013_172130_site_settings_and_cleanup_a');
  const txId = (await payload.db.beginTransaction()) as string | number;
  const db = (payload.db as unknown as { sessions: Record<string, { db: any }> }).sessions[txId].db;
  const req = { transactionID: txId };
  const args = { db, payload, req } as never;
  try {
    // 旧スキーマの数値へ戻せない値が残らないよう、downの前に対象表を空にする
    await db.execute(sql`
      DELETE FROM "sponsors"; DELETE FROM "student_exhibitions";
      DELETE FROM "faq_items"; DELETE FROM "map_areas"; DELETE FROM "parking_lots"; DELETE FROM "stages";
      DELETE FROM "telops"; DELETE FROM "signage_groups";`);
    await mig.down(args);
    await db.execute(sql`DELETE FROM "festival_meta"; DELETE FROM "page_home";`);
    await run({
      payload,
      req,
      q: async (query) => (await db.execute(query)).rows as Row[],
      up: () => mig.up(args),
      down: () => mig.down(args),
    });
  } finally {
    await payload.db.rollbackTransaction(txId);
  }
}

describe.skipIf(!hasDatabase)('マイグレーションA', () => {
  it('祭基本情報・開催日程・ヒーロー画像の順がサイト設定へ移る', async () => {
    await withOldSchema(async ({ payload, req, q, up }) => {
      const media = await q(
        sql`INSERT INTO "media" ("id") VALUES (901), (902), (903) RETURNING "id"`,
      );
      expect(media).toHaveLength(3);
      await q(sql`
        INSERT INTO "festival_meta" ("id", "name", "theme_word", "contact_form_url", "exhibitor_contact_url", "sns_links", "og_image_id", "updated_at", "created_at")
        VALUES (7, '荒牧祭', '万彩', 'https://example.com/form', 'https://example.com/ex', '[{"k":1}]'::jsonb, 902, '2026-09-01T00:00:00Z', '2026-08-01T00:00:00Z')`);
      await q(sql`
        INSERT INTO "festival_meta_event_days" ("_order", "_parent_id", "id", "start_at", "end_at", "label") VALUES
        (1, 7, 'd1', '2026-11-01T00:00:00Z', '2026-11-01T09:00:00Z', '1日目'),
        (2, 7, 'd2', '2026-11-02T00:00:00Z', '2026-11-02T09:00:00Z', NULL)`);
      await q(sql`INSERT INTO "page_home" ("id") VALUES (1)`);
      await q(sql`
        INSERT INTO "page_home_rels" ("order", "parent_id", "path", "media_id") VALUES
        (1, 1, 'hero_images', 903), (2, 1, 'hero_images', 901), (3, 1, 'hero_images', 902)`);

      await up();

      const site = await payload.findGlobal({ slug: 'site_settings', depth: 0, req });
      expect(site).toMatchObject({
        name: '荒牧祭',
        theme_word: '万彩',
        contact_form_url: 'https://example.com/form',
        exhibitor_contact_url: 'https://example.com/ex',
        sns_links: [{ k: 1 }],
        og_image: 902,
        hero_images: [903, 901, 902],
      });
      expect(site.event_days!.map((d: Row) => [d.id, d.label])).toEqual([
        ['d1', '1日目'],
        ['d2', null],
      ]);
      const [row] = await q(
        sql`SELECT updated_at, created_at, nextval(pg_get_serial_sequence('site_settings', 'id')) AS next FROM "site_settings"`,
      );
      expect(new Date(row.updated_at as string).toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(new Date(row.created_at as string).toISOString()).toBe('2026-08-01T00:00:00.000Z');
      expect(Number(row.next)).toBe(8);
    });
  });

  it('「すべて」以外の全グループへ既存テロップがテロップの並び順で所属する', async () => {
    await withOldSchema(async ({ q, up }) => {
      await q(sql`
        INSERT INTO "signage_groups" ("id", "name", "is_all") VALUES (1, 'すべて', true), (2, 'A', false), (3, 'B', NULL)`);
      await q(sql`
        INSERT INTO "telops" ("id", "_order", "body") VALUES (10, 'a2', 'x'), (11, 'a0', 'y'), (12, 'a1', 'z')`);
      await up();
      const rows = await q(sql`
        SELECT "parent_id", "order", "telops_id" FROM "signage_groups_rels" WHERE "path" = 'telops' ORDER BY "parent_id", "order"`);
      expect(rows.map((r) => [r.parent_id, r.order, r.telops_id])).toEqual([
        [2, 1, 11], [2, 2, 12], [2, 3, 10],
        [3, 1, 11], [3, 2, 12], [3, 3, 10],
      ]);
    });
  });

  it('downでテロップの所属行を残さない', async () => {
    await withOldSchema(async ({ q, up, down }) => {
      await q(sql`INSERT INTO "signage_groups" ("id", "name", "is_all") VALUES (2, 'A', false)`);
      await q(sql`INSERT INTO "telops" ("id", "_order", "body") VALUES (10, 'a0', 'x')`);
      await up();
      await down();
      const rows = await q(sql`SELECT "id" FROM "signage_groups_rels" WHERE "path" = 'telops'`);
      expect(rows).toEqual([]);
    });
  });

  it('並びキーが移行前の表示順による並びと一致し、後から作った文書は末尾に入る', async () => {
    await withOldSchema(async ({ payload, req, q, up }) => {
      // sort の同値・null、created_at の差、36件を超えるキー長の切り替わりを含める
      const faq = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        sort: i % 5 === 0 ? null : i % 4,
        created: new Date(Date.UTC(2026, 0, 1 + (i % 7))).toISOString(),
      }));
      for (const f of faq) {
        await q(sql`INSERT INTO "faq_items" ("id", "question", "answer", "sort", "created_at")
          VALUES (${f.id}, 'q', 'a', ${f.sort}, ${f.created})`);
      }
      await q(sql`SELECT setval(pg_get_serial_sequence('faq_items', 'id'), 40)`);
      const stages = [
        { id: 1, sort: 2 }, { id: 2, sort: null }, { id: 3, sort: 0 }, { id: 4, sort: 2 }, { id: 5, sort: null },
      ];
      for (const s of stages) {
        await q(sql`INSERT INTO "stages" ("id", "name", "sort") VALUES (${s.id}, 's', ${s.sort})`);
      }
      await up();

      const byKey = async (table: 'faq_items' | 'stages') =>
        (await q(sql.raw(`SELECT "id", "_order" FROM "${table}" ORDER BY "_order" COLLATE "C"`))).map((r) => r.id);
      const expectedFaq = [...faq]
        .sort((a, b) =>
          (a.sort ?? Infinity) - (b.sort ?? Infinity) || (a.created < b.created ? 1 : a.created > b.created ? -1 : 0) || b.id - a.id,
        )
        .map((f) => f.id);
      // Infinity - Infinity は NaN になり || で次の比較へ落ちる(null 同士は同値扱い)
      expect(await byKey('faq_items')).toEqual(expectedFaq);
      expect(await byKey('stages')).toEqual(
        [...stages].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id).map((s) => s.id),
      );

      const created = await payload.create({
        collection: 'faq_items',
        data: { question: 'new', answer: 'new' },
        overrideAccess: true,
        req,
      });
      const [last] = await q(sql`SELECT "id" FROM "faq_items" ORDER BY "_order" COLLATE "C" DESC LIMIT 1`);
      expect(last.id).toBe(created.id);
    });
  });

  it('価格がnumericへ変換される', async () => {
    await withOldSchema(async ({ q, up }) => {
      await q(sql`INSERT INTO "users" ("id", "email") VALUES (1, 'migration-a@example.invalid')`);
      await q(sql`INSERT INTO "student_exhibitions" ("id", "owner_id") VALUES (1, 1)`);
      await q(sql`INSERT INTO "student_exhibitions_vendor_menu" ("_order", "_parent_id", "id", "name", "price")
        VALUES (1, 1, 'm1', 'x', '300'), (2, 1, 'm2', 'y', NULL), (3, 1, 'm3', 'z', ''), (4, 1, 'm4', 'w', ' 150 '),
        (5, 1, 'm5', 'a', '400円'), (6, 1, 'm6', 'b', '¥1,000'), (7, 1, 'm7', 'c', '４００円'), (8, 1, 'm8', 'd', '無料')`);
      await up();
      const rows = await q(sql`SELECT "price" FROM "student_exhibitions_vendor_menu" ORDER BY "_order"`);
      expect(rows.map((r) => (r.price === null ? null : Number(r.price)))).toEqual([300, null, null, 150, 400, 1000, 400, null]);
    });
  });
});
