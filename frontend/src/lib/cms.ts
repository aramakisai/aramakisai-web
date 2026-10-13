import type { Config } from '@/cms-types';
import { cache } from 'react';
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
  readonly select?: Readonly<Record<string, boolean>>;
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
  select?: Readonly<Record<string, boolean>>;
}): string {
  const parts: string[] = [];
  if (query.where) flatten('where', query.where, parts);
  if (query.sort?.length) parts.push(`sort=${query.sort.join(',')}`);
  if (query.limit !== undefined) parts.push(`limit=${query.limit}`);
  if (query.depth !== undefined) parts.push(`depth=${query.depth}`);
  if (query.select) flatten('select', query.select, parts);
  return parts.join('&');
}

// Workers から CMS オリジンへの往復が TTFB の主因のため、公開 GET を Cache API に短期間保持する。
// request() は認証ヘッダも cookie も付けない公開リクエストだけを扱うので全呼び出しが対象になる。
const DEFAULT_CACHE_TTL_SECONDS = 60;

export type CmsFetchOptions = {
  readonly ttlSeconds?: number;
  /** 通常のキーを読まず、版付きのキー(__v)で取得・保存する */
  readonly version?: number;
};

function getEdgeCache(): Cache | undefined {
  if (typeof caches === 'undefined') return undefined;
  return (caches as unknown as { default?: Cache }).default;
}

async function cachedFetch(
  url: string,
  ttlSeconds: number,
  version?: number,
): Promise<Response> {
  const cache = getEdgeCache();
  // TTL 0 は即時反映が要る取得。エッジキャッシュも Next の fetch キャッシュも通さない
  if (ttlSeconds === 0) return fetch(url, { cache: 'no-store' });
  if (!cache) return fetch(url);
  const withParam = (name: string, value: number) =>
    new Request(`${url}${url.includes('?') ? '&' : '?'}${name}=${value}`);
  // キャッシュキーは URL のみなので、既定外の TTL は別キーにして同じクエリを別 TTL と共有しない。
  // 版付きは通常のキーを読み書きしない: 保存より前の内容が残っていても返さないため
  const key =
    version !== undefined
      ? withParam('__v', version)
      : ttlSeconds === DEFAULT_CACHE_TTL_SECONDS
        ? new Request(url)
        : withParam('__cache_ttl', ttlSeconds);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(url);
  if (response.ok) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const { waitUntil } = getCloudflareContext().ctx;
      const stored = new Response(response.clone().body, response);
      stored.headers.set('Cache-Control', `s-maxage=${ttlSeconds}`);
      waitUntil(cache.put(key, stored));
    } catch {
      // waitUntil を取れない環境では保存を諦める (応答自体は返す)
    }
  }
  return response;
}

// 引数がすべてプリミティブなので React.cache のキーが一致する。
// 1 描画内で同じ URL の取得 (generateMetadata・本体・footer の festival_meta 等) を
// 1 回にまとめ、Cache API の照会と JSON パースの重複を避ける。ttl・version が違う呼び出しは別キー
const request = cache(requestUncached) as typeof requestUncached;

async function requestUncached<T>(
  path: string,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS,
  version?: number,
): Promise<CmsResult<T>> {
  try {
    const response = await cachedFetch(
      `${env.NEXT_PUBLIC_CMS_URL}${path}`,
      ttlSeconds,
      version,
    );
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
    options: CmsFetchOptions = {},
  ): Promise<CmsResult<CmsListResponse<CmsCollections[K]>>> {
    return request(
      withQuery(`/api/${String(collection)}`, buildQueryString(query)),
      options.ttlSeconds,
      options.version,
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
    options: CmsFetchOptions = {},
  ): Promise<CmsResult<CmsGlobals[K]>> {
    // populate が要る global は呼び出し側で depth を明示する。既定を 0 に揃えると
    // URL (= Workers Cache API のキー) が 1 種類になり、CMS の DB 問い合わせも減る。
    return request(
      withQuery(
        `/api/globals/${String(slug)}`,
        buildQueryString({ depth: 0, ...query }),
      ),
      options.ttlSeconds,
      options.version,
    );
  },
};
