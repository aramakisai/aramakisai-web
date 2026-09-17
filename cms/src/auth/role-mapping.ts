import type { CmsRole } from '../access/roles';

/**
 * Authentik のグループ名とロールの対応。実行値は Directus の AUTH_AUTHENTIK_ROLE_MAPPING を出発点とする。
 * 実行時に変更されない静的な写像として持つ。
 */
const GROUP_TO_ROLE: Record<string, CmsRole> = {
  管理者: 'executive',
  executive: 'executive',
  student_exhibitor: 'student_exhibitor',
};

/** 権限の広い順。兼務時はより広いロールを採る。 */
const ROLE_PRECEDENCE: readonly CmsRole[] = ['executive', 'student_exhibitor'];

export function resolveRole(groups: readonly string[]): CmsRole | null {
  const matched = new Set(
    groups.map((group) => GROUP_TO_ROLE[group]).filter((role): role is CmsRole => !!role),
  );
  return ROLE_PRECEDENCE.find((role) => matched.has(role)) ?? null;
}
