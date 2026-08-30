import type { CmsRole } from '../access/roles';
import { resolveRole } from './role-mapping';

export type CmsIdentity = {
  readonly subject: string;
  readonly email: string;
  readonly role: CmsRole;
};

/**
 * IdP の userinfo を CMS の識別情報へ写像する。
 * 既知のグループに一致しない場合は null を返し、呼び出し側はセッションを確立しない。
 */
export function toCmsIdentity(userinfo: Record<string, unknown>): CmsIdentity | null {
  const subject = userinfo.sub;
  const email = userinfo.email;
  const groups = userinfo.groups;
  if (typeof subject !== 'string' || typeof email !== 'string') return null;
  if (!Array.isArray(groups)) return null;

  const role = resolveRole(groups.filter((g): g is string => typeof g === 'string'));
  if (!role) return null;

  return { subject, email, role };
}
