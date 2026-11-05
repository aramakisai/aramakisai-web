import { APIError, type CollectionBeforeOperationHook, type Payload } from 'payload';

import { canRead } from './policy';
import { isExecutive, toCmsUser, type CmsUser } from './roles';

type FlatField = {
  name?: string;
  type: string;
  relationTo?: string | string[];
  collection?: string | string[];
  flattenedFields?: FlatField[];
  blocks?: { flattenedFields?: FlatField[] }[];
};

const POLYMORPHIC_LEAVES = new Set(['id', 'value', 'relationTo']);

const asArray = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * Payload は where/sort の関連先パスで項目単位の read 権限しか見ず、関連先コレクションの
 * read 条件 (公開のみ等) を適用しない。条件付きの関連先を辿るパスは、非公開の値を
 * 一致・並び順で推測できるため、行の権限を回避できない形で拒否する。
 */
function crossesRestrictedRelation(payload: Payload, slug: string, user: CmsUser | null, path: string): boolean {
  const walk = (fields: FlatField[], segments: string[]): boolean => {
    const [head, ...rest] = segments;
    if (head === undefined) return false;
    const candidates = fields.filter((f) => f.name === head);
    return candidates.some((field) => {
      if (field.type === 'relationship' || field.type === 'upload' || field.type === 'join') {
        if (rest.every((s) => POLYMORPHIC_LEAVES.has(s))) return false;
        const targets = asArray(field.type === 'join' ? field.collection : field.relationTo);
        return targets.some((target) => {
          if (canRead(user, target) !== true) return true;
          const targetFields = (payload.collections as Record<string, { config: { flattenedFields: unknown } } | undefined>)[target]?.config.flattenedFields as FlatField[] | undefined;
          return targetFields ? walk(targetFields, rest[0] === 'value' ? rest.slice(1) : rest) : false;
        });
      }
      if (field.flattenedFields) return walk(field.flattenedFields, rest);
      if (field.blocks) return field.blocks.some((b) => walk(b.flattenedFields ?? [], rest));
      return false;
    });
  };
  const top = (payload.collections as Record<string, { config: { flattenedFields: unknown } } | undefined>)[slug]?.config.flattenedFields as FlatField[] | undefined;
  return top ? walk(top, path.replace(/__/g, '.').split('.')) : false;
}

function wherePaths(where: unknown, out: string[] = []): string[] {
  if (!where || typeof where !== 'object') return out;
  for (const [key, value] of Object.entries(where)) {
    if (['and', 'or'].includes(key.toLowerCase()) && Array.isArray(value)) value.forEach((v) => wherePaths(v, out));
    else out.push(key);
  }
  return out;
}

function sortPaths(sort: unknown): string[] {
  const list = Array.isArray(sort) ? sort : typeof sort === 'string' ? sort.split(',') : [];
  return list.filter((s): s is string => typeof s === 'string').map((s) => s.replace(/^-/, ''));
}

export const guardRelationQuery: CollectionBeforeOperationHook = ({ args, collection, operation, req }) => {
  if (!['read', 'count', 'readDistinct'].includes(operation)) return args;
  const a = args as { overrideAccess?: boolean; where?: unknown; sort?: unknown; field?: unknown };
  if (a.overrideAccess) return args;
  const user = toCmsUser(req.user);
  if (isExecutive(user)) return args;
  const paths = [...wherePaths(a.where), ...sortPaths(a.sort), ...(typeof a.field === 'string' ? [a.field] : [])];
  if (paths.some((p) => crossesRestrictedRelation(req.payload, collection.slug, user, p))) {
    throw new APIError('このクエリは許可されていません。', 403, undefined, true);
  }
  return args;
};
