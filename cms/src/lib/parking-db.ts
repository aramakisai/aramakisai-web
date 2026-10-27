/** 受信・ジョブ・稼働監視が使う Local API の最小の形。型生成の有無やテストの差し替えに左右されないよう、使う操作だけを写す */
export interface ParkingDb {
  find(args: Record<string, unknown>): Promise<{ docs: Record<string, any>[] }>;
  findByID(args: Record<string, unknown>): Promise<Record<string, any> | null>;
  findGlobal(args: Record<string, unknown>): Promise<Record<string, any>>;
  create(args: Record<string, unknown>): Promise<Record<string, any>>;
  update(args: Record<string, unknown>): Promise<{ docs?: Record<string, any>[] } & Record<string, any>>;
  delete(args: Record<string, unknown>): Promise<unknown>;
  db: { pool: { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null }> } };
  jobs: { queue(args: Record<string, unknown>): Promise<unknown> };
  logger: { warn(message: string): void };
}
