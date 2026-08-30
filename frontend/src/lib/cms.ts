import type { Config } from '@/cms-types';
import { env } from '@/env';

type CmsCollections = Config['collections'];
type CmsGlobals = Config['globals'];

export type CmsCollectionSlug = keyof CmsCollections;
export type CmsGlobalSlug = keyof CmsGlobals;

export type CmsListResponse<T> = {
  readonly docs: readonly T[];
  readonly totalDocs: number;
};

export type CmsFetchError =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'network'; readonly status: number };

export type CmsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CmsFetchError };

type Operators<V> = {
  equals?: V;
  not_equals?: V;
  less_than?: V;
  less_than_equal?: V;
  greater_than?: V;
  greater_than_equal?: V;
  in?: readonly V[];
  exists?: boolean;
};

export type CmsWhere<T> = {
  [K in keyof T]?: Operators<T[K]>;
} & {
  and?: readonly CmsWhere<T>[];
  or?: readonly CmsWhere<T>[];
};

export type CmsQuery<T> = {
  readonly where?: CmsWhere<T>;
  readonly sort?: readonly `${'-' | ''}${Extract<keyof T, string>}`[];
  readonly limit?: number;
  readonly depth?: number;
};

function flatten(prefix: string, value: unknown, out: string[]): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(`${prefix}[${index}]`, item, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      flatten(`${prefix}[${key}]`, nested, out);
    }
    return;
  }
  out.push(
    `${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`,
  );
}

export function buildQueryString(query: {
  where?: unknown;
  sort?: readonly string[];
  limit?: number;
  depth?: number;
}): string {
  const parts: string[] = [];
  if (query.where) flatten('where', query.where, parts);
  if (query.sort?.length) parts.push(`sort=${query.sort.join(',')}`);
  if (query.limit !== undefined) parts.push(`limit=${query.limit}`);
  if (query.depth !== undefined) parts.push(`depth=${query.depth}`);
  return parts.join('&');
}

async function request<T>(path: string): Promise<CmsResult<T>> {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_CMS_URL}${path}`);
    if (!response.ok) {
      if (response.status === 404)
        return { ok: false, error: { kind: 'not_found' } };
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: { kind: 'unauthorized' } };
      }
      return { ok: false, error: { kind: 'network', status: response.status } };
    }
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, error: { kind: 'network', status: 0 } };
  }
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

export const cms = {
  findMany<K extends CmsCollectionSlug>(
    collection: K,
    query: CmsQuery<CmsCollections[K]>,
  ): Promise<CmsResult<CmsListResponse<CmsCollections[K]>>> {
    return request(
      withQuery(`/api/${String(collection)}`, buildQueryString(query)),
    );
  },

  findById<K extends CmsCollectionSlug>(
    collection: K,
    id: number | string,
    query: Pick<CmsQuery<CmsCollections[K]>, 'depth'> = {},
  ): Promise<CmsResult<CmsCollections[K]>> {
    return request(
      withQuery(`/api/${String(collection)}/${id}`, buildQueryString(query)),
    );
  },

  findGlobal<K extends CmsGlobalSlug>(
    slug: K,
    query: { depth?: number } = {},
  ): Promise<CmsResult<CmsGlobals[K]>> {
    return request(
      withQuery(`/api/globals/${String(slug)}`, buildQueryString(query)),
    );
  },
};
