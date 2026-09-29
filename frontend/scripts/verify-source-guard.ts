import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface SourceGuardViolation {
  file: string;
  forbidden: string;
}

/**
 * dir 以下から extensions に一致するファイルを再帰的に集める。テストファイル
 * (*.test.ts(x)) は対象コードではなく期待値の記述にも同じ文字列が現れるため除外する。
 */
export function listSourceFiles(
  dir: string,
  extensions: readonly string[],
  exclude: readonly string[] = [],
): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...listSourceFiles(full, extensions, exclude));
      continue;
    }

    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (exclude.some((rel) => full.endsWith(rel))) continue;

    results.push(full);
  }

  return results;
}

export function findForbiddenStrings(
  files: readonly string[],
  forbidden: readonly string[],
): SourceGuardViolation[] {
  const violations: SourceGuardViolation[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const needle of forbidden) {
      if (content.includes(needle)) {
        violations.push({ file, forbidden: needle });
      }
    }
  }

  return violations;
}
