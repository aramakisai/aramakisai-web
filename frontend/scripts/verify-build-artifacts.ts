import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// phase-toggle.tsx にのみ現れる UI 文言。Cookie 名 (PHASE_OVERRIDE_COOKIE) は
// header.tsx / map-menu-button.tsx がナビ絞り込み (visibleNavItems) のために
// phase.ts を常時 import するため、開発用フラグ無効ビルドでも正当な理由で
// 成果物に残り、目印として使えない。
export const FORBIDDEN_STRINGS: readonly string[] = [
  'に切り替える',
  'オーバーライドを解除する',
];

export interface ForbiddenStringMatch {
  readonly file: string;
  readonly forbidden: string;
}

export async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath];
    }),
  );
  return nested.flat();
}

export function findForbiddenStringsInContent(
  content: string,
  forbiddenStrings: readonly string[],
): readonly string[] {
  return forbiddenStrings.filter((forbidden) => content.includes(forbidden));
}

export async function scanForForbiddenStrings(
  dirPath: string,
  forbiddenStrings: readonly string[] = FORBIDDEN_STRINGS,
): Promise<readonly ForbiddenStringMatch[]> {
  const files = await listFilesRecursive(dirPath);
  const matches: ForbiddenStringMatch[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf-8').catch(() => '');
    for (const forbidden of findForbiddenStringsInContent(
      content,
      forbiddenStrings,
    )) {
      matches.push({ file, forbidden });
    }
  }
  return matches;
}

// 本番で cookies() を呼ばず静的化 (ISR) されているべきルート。
export const REQUIRED_PRERENDERED_ROUTES: readonly string[] = [
  '/',
  '/faq',
  '/topics',
];

export function findMissingPrerenderedRoutes(
  manifest: { routes?: Record<string, unknown> },
  required: readonly string[] = REQUIRED_PRERENDERED_ROUTES,
): readonly string[] {
  const routes = manifest.routes ?? {};
  return required.filter((route) => !(route in routes));
}

async function main(): Promise<void> {
  // wrangler.toml の main = ".open-next/worker.js" と [assets] directory が
  // 示すとおり、実行基盤へ実際に配信されるのはこの出力全体である。.next/ のみを
  // 走査すると OpenNext による esbuild 再バンドルの結果を見落とす。
  const outputDir = path.join(__dirname, '..', '.open-next');
  const matches = await scanForForbiddenStrings(outputDir);

  if (matches.length > 0) {
    console.error(
      '本番相当ビルドの成果物に開発用フェーズ切替 UI の痕跡が見つかりました:',
    );
    for (const match of matches) {
      console.error(`  ${match.file}: "${match.forbidden}"`);
    }
    process.exitCode = 1;
    return;
  }

  // フェーズ切替を有効にしたビルドは cookies() を読むため静的化しない
  if (process.env.NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE !== 'true') {
    const manifest = JSON.parse(
      await readFile(
        path.join(__dirname, '..', '.next', 'prerender-manifest.json'),
        'utf-8',
      ),
    ) as { routes?: Record<string, unknown> };
    const missing = findMissingPrerenderedRoutes(manifest);
    if (missing.length > 0) {
      console.error(
        `本番相当ビルドで静的化されていないルート: ${missing.join(', ')}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `開発用フェーズ切替 UI の痕跡は見つかりませんでした (${outputDir})`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
