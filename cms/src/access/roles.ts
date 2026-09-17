export const CMS_ROLES = ['executive', 'student_exhibitor'] as const;

export type CmsRole = (typeof CMS_ROLES)[number];

export type CmsUser = {
  readonly id: string | number;
  readonly role: CmsRole;
};

export function isCmsRole(value: unknown): value is CmsRole {
  return (CMS_ROLES as readonly unknown[]).includes(value);
}

/** Payload の `req.user` は any 相当のため、ロールを検証してから CmsUser として扱う。 */
export function toCmsUser(user: unknown): CmsUser | null {
  if (!user || typeof user !== 'object') return null;
  const { id, role } = user as { id?: unknown; role?: unknown };
  if (id === undefined || id === null) return null;
  if (!isCmsRole(role)) return null;
  return { id: id as string | number, role };
}

export function isExecutive(user: CmsUser | null): boolean {
  return user?.role === 'executive';
}

export function isStudentExhibitor(user: CmsUser | null): boolean {
  return user?.role === 'student_exhibitor';
}
