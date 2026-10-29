import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import type { D1Binding } from '@/lib/cloudflare-env';

const migration = readFileSync(
  join(__dirname, '../../migrations/0001_stamp_rally.sql'),
  'utf8',
);

export async function openTestD1() {
  const dir = mkdtempSync(join(tmpdir(), 'stamp-d1-'));
  const config = join(dir, 'wrangler.toml');
  writeFileSync(
    config,
    `name = "t"\ncompatibility_date = "2026-01-01"\n[[d1_databases]]\nbinding = "STAMP_DB"\ndatabase_name = "t"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n`,
  );
  const proxy = await getPlatformProxy<{ STAMP_DB: D1Binding }>({
    configPath: config,
    persist: false,
  });
  const db = proxy.env.STAMP_DB;
  return {
    db,
    async count(table: 'stamps' | 'exchanges') {
      const row = await (
        db.prepare(`SELECT COUNT(*) AS n FROM ${table}`) as unknown as {
          first<T>(): Promise<T | null>;
        }
      ).first<{ n: number }>();
      return row!.n;
    },
    async reset() {
      await db.prepare('DROP TABLE IF EXISTS stamps').run();
      await db.prepare('DROP TABLE IF EXISTS exchanges').run();
      for (const stmt of migration
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)) {
        await db.prepare(stmt).run();
      }
    },
    async close() {
      await proxy.dispose();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
