import { describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

/**
 * 手書きマイグレーションが入れた制約は Payload の定義から復元できないため、
 * 適用済みであることを DB のカタログに対して直接確認する。
 */
describe.skipIf(!hasDatabase)('手書きマイグレーションの制約', () => {
  async function catalogNames() {
    const { getPayload } = await import('payload');
    const config = (await import('./payload.config')).default;
    const payload = await getPayload({ config });
    const pool = (
      payload.db as unknown as {
        pool: { query: (sql: string) => Promise<{ rows: { name: string }[] }> };
      }
    ).pool;
    const constraints = await pool.query('select conname as name from pg_constraint');
    const indexes = await pool.query(
      "select indexname as name from pg_indexes where schemaname = 'public'",
    );
    return new Set([...constraints.rows, ...indexes.rows].map((row) => row.name));
  }

  it('スナップショットで表現できない制約がすべて適用されている', async () => {
    const names = await catalogNames();
    for (const expected of [
      'performance_slots_exhibition_or_title_required',
      'performance_slots_stage_time_slot_unique',
      'student_exhibitions_area_booth_unique',
      'sponsors_area_booth_unique',
      // Authentik の sub による突合が一意であることに依存している
      'users_authentik_sub_idx',
    ]) {
      expect(names.has(expected), `${expected} が無い`).toBe(true);
    }
  });
});
