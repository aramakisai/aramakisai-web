/**
 * 環境変数はすべて Infisical からシェル経由で注入する。`.env` は作らない。
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が未設定。Infisical 経由で注入すること (infisical run --env=... -- pnpm dev)`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
