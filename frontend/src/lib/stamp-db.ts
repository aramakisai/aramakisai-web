import type { StampCategory } from './stamp-signature';

// D1Database の必要部分だけを構造的に受ける。Next 側の型設定に Workers の型を持ち込まないため
interface StampD1Meta {
  readonly rows_read?: number;
  readonly rows_written?: number;
  readonly duration?: number;
  readonly changes?: number;
}
interface StampD1Result<T> {
  readonly results: T[];
  readonly meta: StampD1Meta;
}
interface StampD1Statement {
  bind(...values: unknown[]): StampD1Statement;
  run(): Promise<{ readonly meta: StampD1Meta }>;
}
export interface StampD1 {
  prepare(sql: string): StampD1Statement;
  batch<T = unknown>(
    statements: StampD1Statement[],
  ): Promise<StampD1Result<T>[]>;
}

export interface D1Usage {
  readonly rowsRead: number;
  readonly rowsWritten: number;
  readonly durationMs: number;
}

export type DbResult<T> =
  | { readonly ok: true; readonly value: T; readonly usage: D1Usage }
  | { readonly ok: false; readonly usage: D1Usage };

export interface StampRecord {
  readonly exhibitionId: number;
  readonly category: StampCategory;
  readonly acquiredAt: string;
}

export interface ExchangeRecord {
  readonly exchangeId: number;
  readonly visitorId: string;
  readonly exchangedAt: string;
  readonly exchangedBy: string;
  readonly cancelledAt: string | null;
  readonly cancelledBy: string | null;
}

export interface VisitorRecord {
  readonly stamps: readonly StampRecord[];
  readonly activeExchange: ExchangeRecord | null;
}

export type RegisterExchangeOutcome =
  | { readonly kind: 'registered'; readonly exchange: ExchangeRecord }
  | { readonly kind: 'already'; readonly exchange: ExchangeRecord };

export type CancelExchangeOutcome =
  | { readonly kind: 'cancelled'; readonly exchange: ExchangeRecord }
  | { readonly kind: 'already'; readonly exchange: ExchangeRecord }
  | { readonly kind: 'not_found' };

export interface AllRecords {
  readonly stamps: readonly (StampRecord & { readonly visitorId: string })[];
  readonly activeExchangeCount: number;
}

export interface StampRepository {
  recordStamp(
    visitorId: string,
    exhibitionId: number,
    category: StampCategory,
    now: Date,
  ): Promise<DbResult<'added' | 'exists'>>;
  listStamps(visitorId: string): Promise<DbResult<readonly StampRecord[]>>;
  getVisitorRecord(visitorId: string): Promise<DbResult<VisitorRecord>>;
  registerExchange(
    visitorId: string,
    staff: string,
    now: Date,
  ): Promise<DbResult<RegisterExchangeOutcome>>;
  cancelExchange(
    exchangeId: number,
    staff: string,
    now: Date,
  ): Promise<DbResult<CancelExchangeOutcome>>;
  listExchanges(): Promise<DbResult<readonly ExchangeRecord[]>>;
  loadAllRecords(): Promise<DbResult<AllRecords>>;
}

interface StampRow {
  visitor_id: string;
  exhibition_id: number;
  category: StampCategory;
  acquired_at: string;
}
interface ExchangeRow {
  exchange_id: number;
  visitor_id: string;
  exchanged_at: string;
  exchanged_by: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
}

const toStamp = (r: StampRow): StampRecord => ({
  exhibitionId: r.exhibition_id,
  category: r.category,
  acquiredAt: r.acquired_at,
});

const toExchange = (r: ExchangeRow): ExchangeRecord => ({
  exchangeId: r.exchange_id,
  visitorId: r.visitor_id,
  exchangedAt: r.exchanged_at,
  exchangedBy: r.exchanged_by,
  cancelledAt: r.cancelled_at,
  cancelledBy: r.cancelled_by,
});

const EXCHANGE_COLUMNS =
  'exchange_id, visitor_id, exchanged_at, exchanged_by, cancelled_at, cancelled_by';
const STAMP_COLUMNS = 'visitor_id, exhibition_id, category, acquired_at';

function sumUsage(metas: readonly StampD1Meta[]): D1Usage {
  return {
    rowsRead: metas.reduce((n, m) => n + (m.rows_read ?? 0), 0),
    rowsWritten: metas.reduce((n, m) => n + (m.rows_written ?? 0), 0),
    durationMs: metas.reduce((n, m) => n + (m.duration ?? 0), 0),
  };
}

const ZERO_USAGE: D1Usage = { rowsRead: 0, rowsWritten: 0, durationMs: 0 };

export function createStampRepository(db: StampD1): StampRepository {
  // D1 の例外を外に出さず、成功時は meta を合算して添える
  async function run<T>(
    statements: StampD1Statement[],
    build: (results: StampD1Result<never>[]) => T | Promise<T>,
  ): Promise<DbResult<T>> {
    try {
      const results = (await db.batch(statements)) as StampD1Result<never>[];
      return {
        ok: true,
        value: await build(results),
        usage: sumUsage(results.map((r) => r.meta)),
      };
    } catch {
      return { ok: false, usage: ZERO_USAGE };
    }
  }

  const rows = <R>(r: StampD1Result<never> | undefined) =>
    (r?.results ?? []) as R[];

  return {
    recordStamp: (visitorId, exhibitionId, category, now) =>
      run(
        [
          db
            .prepare(
              `INSERT INTO stamps (${STAMP_COLUMNS}) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
            )
            .bind(visitorId, exhibitionId, category, now.toISOString()),
        ],
        ([r]) =>
          r.meta.changes === 1 ? ('added' as const) : ('exists' as const),
      ),

    listStamps: (visitorId) =>
      run(
        [
          db
            .prepare(
              `SELECT ${STAMP_COLUMNS} FROM stamps WHERE visitor_id = ? ORDER BY acquired_at, exhibition_id, category`,
            )
            .bind(visitorId),
        ],
        ([r]) => rows<StampRow>(r).map(toStamp),
      ),

    getVisitorRecord: (visitorId) =>
      run(
        [
          db
            .prepare(
              `SELECT ${STAMP_COLUMNS} FROM stamps WHERE visitor_id = ? ORDER BY acquired_at, exhibition_id, category`,
            )
            .bind(visitorId),
          db
            .prepare(
              `SELECT ${EXCHANGE_COLUMNS} FROM exchanges WHERE visitor_id = ? AND cancelled_at IS NULL`,
            )
            .bind(visitorId),
        ],
        ([s, e]) => {
          const active = rows<ExchangeRow>(e)[0];
          return {
            stamps: rows<StampRow>(s).map(toStamp),
            activeExchange: active ? toExchange(active) : null,
          };
        },
      ),

    // 部分一意索引への衝突を ON CONFLICT で吸収し、同じバッチ(1 トランザクション)で有効な行を読む。
    // 同時 2 件でも片方は changes=0 になり、成立した側の行を返せる
    registerExchange: (visitorId, staff, now) =>
      run(
        [
          db
            .prepare(
              `INSERT INTO exchanges (visitor_id, exchanged_at, exchanged_by) VALUES (?, ?, ?)
               ON CONFLICT (visitor_id) WHERE cancelled_at IS NULL DO NOTHING`,
            )
            .bind(visitorId, now.toISOString(), staff),
          db
            .prepare(
              `SELECT ${EXCHANGE_COLUMNS} FROM exchanges WHERE visitor_id = ? AND cancelled_at IS NULL`,
            )
            .bind(visitorId),
        ],
        ([ins, sel]) => {
          const row = rows<ExchangeRow>(sel)[0];
          if (!row) throw new Error('active exchange missing');
          return {
            kind:
              ins.meta.changes === 1
                ? ('registered' as const)
                : ('already' as const),
            exchange: toExchange(row),
          };
        },
      ),

    cancelExchange: (exchangeId, staff, now) =>
      run(
        [
          db
            .prepare(
              `UPDATE exchanges SET cancelled_at = ?, cancelled_by = ? WHERE exchange_id = ? AND cancelled_at IS NULL`,
            )
            .bind(now.toISOString(), staff, exchangeId),
          db
            .prepare(
              `SELECT ${EXCHANGE_COLUMNS} FROM exchanges WHERE exchange_id = ?`,
            )
            .bind(exchangeId),
        ],
        ([upd, sel]): CancelExchangeOutcome => {
          const row = rows<ExchangeRow>(sel)[0];
          if (!row) return { kind: 'not_found' };
          return {
            kind: upd.meta.changes === 1 ? 'cancelled' : 'already',
            exchange: toExchange(row),
          };
        },
      ),

    listExchanges: () =>
      run(
        [
          db.prepare(
            `SELECT ${EXCHANGE_COLUMNS} FROM exchanges ORDER BY exchanged_at DESC, exchange_id DESC`,
          ),
        ],
        ([r]) => rows<ExchangeRow>(r).map(toExchange),
      ),

    loadAllRecords: () =>
      run(
        [
          db.prepare(`SELECT ${STAMP_COLUMNS} FROM stamps`),
          db.prepare(
            'SELECT COUNT(*) AS n FROM exchanges WHERE cancelled_at IS NULL',
          ),
        ],
        ([s, c]) => ({
          stamps: rows<StampRow>(s).map((r) => ({
            visitorId: r.visitor_id,
            ...toStamp(r),
          })),
          activeExchangeCount: rows<{ n: number }>(c)[0]?.n ?? 0,
        }),
      ),
  };
}
