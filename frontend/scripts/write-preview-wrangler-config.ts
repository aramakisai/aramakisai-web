import { readFileSync, writeFileSync } from 'node:fs';

// PR プレビューは本番 Worker のバージョンとして上がり、トップレベルのバインディングを使う。
// 本番 DB に書かせないため、トップレベルの STAMP_DB を dev の D1 に差し替える。
export function toPreviewConfig(toml: string): string {
  const split = toml.indexOf('\n[env.dev]');
  if (split < 0) throw new Error('[env.dev] が無い');
  const top = toml.slice(0, split);
  const dev = toml.slice(split);
  const name = dev.match(
    /^\[\[env\.dev\.d1_databases\]\][^[]*?database_name = "([^"]+)"/m,
  )?.[1];
  const id = dev.match(
    /^\[\[env\.dev\.d1_databases\]\][^[]*?database_id = "([^"]+)"/m,
  )?.[1];
  if (!name || !id) throw new Error('env.dev の D1 が無い');
  const replaced = top
    .replace(/^(database_name = )"[^"]+"/m, `$1"${name}"`)
    .replace(/^(database_id = )"[^"]+"/m, `$1"${id}"`);
  if (replaced === top) throw new Error('トップレベルの D1 が無い');
  return replaced + dev;
}

// wrangler は main や assets.directory を設定ファイルの場所から解決するため、出力先は frontend/ 直下にする。
function main(): void {
  const out = process.argv[2];
  if (!out) {
    console.error('usage: write-preview-wrangler-config.ts <output>');
    process.exitCode = 1;
    return;
  }
  writeFileSync(out, toPreviewConfig(readFileSync('wrangler.toml', 'utf-8')));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
