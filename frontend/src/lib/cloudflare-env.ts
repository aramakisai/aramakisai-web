// @cloudflare/workers-types を依存に持たず、サイトの tsconfig は workers/worker-configuration.d.ts を
// 除外している (DOM lib と衝突する) ため、使う面だけを構造的に宣言する
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ meta: Record<string, number> }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; meta: Record<string, number> }>;
}

export interface D1Binding {
  prepare(query: string): D1Statement;
  batch<T = unknown>(
    statements: D1Statement[],
  ): Promise<{ results: T[]; meta: Record<string, number> }[]>;
}

export interface AnalyticsBinding {
  writeDataPoint(point: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type StampEnvName = 'prod' | 'dev' | 'preview';

export interface StampEnv {
  readonly STAMP_DB: D1Binding;
  readonly STAMP_METRICS: AnalyticsBinding;
  readonly STAMP_RATE_LIMITER: RateLimitBinding;
  readonly STAMP_SIGNING_SECRET: string;
  readonly STAMP_ENV: StampEnvName;
  readonly STAFF_OIDC_ISSUER: string;
  readonly STAFF_OIDC_CLIENT_ID: string;
  readonly STAFF_OIDC_CLIENT_SECRET: string;
}

export type StampEnvResult =
  | { readonly ok: true; readonly env: StampEnv }
  | { readonly ok: false; readonly missing: readonly (keyof StampEnv)[] };

const BINDINGS = ['STAMP_DB', 'STAMP_METRICS', 'STAMP_RATE_LIMITER'] as const;
const STRINGS = ['STAMP_SIGNING_SECRET', 'STAFF_OIDC_ISSUER'] as const;
// preview は認証しないため、デプロイにもローカル起動にも渡されない
const STAFF_CLIENT = [
  'STAFF_OIDC_CLIENT_ID',
  'STAFF_OIDC_CLIENT_SECRET',
] as const;

const ENV_NAMES: readonly string[] = ['prod', 'dev', 'preview'];

// STAMP_ENV の欠落や不正値を preview 扱いにすると、本番で管理者認証が素通りになる
export async function readStampEnv(): Promise<StampEnvResult> {
  let raw: Record<string, unknown>;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    raw = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    return { ok: false, missing: ['STAMP_ENV'] };
  }
  const missing: (keyof StampEnv)[] = [];
  for (const k of BINDINGS) {
    if (typeof raw[k] !== 'object' || raw[k] === null) missing.push(k);
  }
  for (const k of STRINGS) {
    if (typeof raw[k] !== 'string' || raw[k] === '') missing.push(k);
  }
  if (typeof raw.STAMP_ENV !== 'string' || !ENV_NAMES.includes(raw.STAMP_ENV)) {
    missing.push('STAMP_ENV');
  }
  const isPreview = raw.STAMP_ENV === 'preview';
  for (const k of STAFF_CLIENT) {
    if (!isPreview && (typeof raw[k] !== 'string' || raw[k] === '')) {
      missing.push(k);
    }
  }
  if (missing.length > 0) return { ok: false, missing };
  const env = { ...raw };
  for (const k of STAFF_CLIENT) env[k] ??= '';
  return { ok: true, env: env as unknown as StampEnv };
}
