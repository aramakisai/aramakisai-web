import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  detectBreakingChanges,
  formatBreakingChange,
  toShape,
  type EntityShape,
} from './collection-shape';

/**
 * base ref の定義を worktree として取り出して読み込む。
 * 定義は TypeScript のため、文字列比較ではなく実際に評価して形を取る。
 */
async function shapesAt(ref: string | null): Promise<readonly EntityShape[]> {
  if (ref === null) {
    const { collections } = await import('../src/collections/index.js');
    const { globals } = await import('../src/globals/index.js');
    return [...collections, ...globals].map(toShape);
  }

  const worktree = mkdtempSync(path.join(tmpdir(), 'cms-base-'));
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktree, ref], {
      stdio: 'ignore',
    });
    // base に CMS がまだ無い場合は比較対象が空。定義の新設は破壊的変更になりえない
    if (!existsSync(path.join(worktree, 'cms/src/collections/index.ts'))) {
      return [];
    }
    const collections = await import(
      path.join(worktree, 'cms/src/collections/index.ts')
    );
    const globals = await import(path.join(worktree, 'cms/src/globals/index.ts'));
    return [...collections.collections, ...globals.globals].map(toShape);
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', worktree], {
      stdio: 'ignore',
    });
    rmSync(worktree, { recursive: true, force: true });
  }
}

const baseRef = process.argv[2];
if (!baseRef) {
  console.error('usage: check-schema-changes <base-ref>');
  process.exit(2);
}

const [base, head] = await Promise.all([shapesAt(baseRef), shapesAt(null)]);
const changes = detectBreakingChanges(base, head);

if (changes.length === 0) {
  console.log('破壊的変更は検出されなかった');
  process.exit(0);
}

console.error('破壊的変更を検出した:');
for (const change of changes) console.error(`  - ${formatBreakingChange(change)}`);
console.error(
  '\nフロントエンド側の対応がデプロイ・安定稼働済みであることを確認し、' +
    'PR に `breaking-change-acknowledged` ラベルを付けてから再実行すること。',
);
process.exit(1);
