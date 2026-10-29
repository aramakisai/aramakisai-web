import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const DATABASES: Record<string, string> = {
  prod: '534d1e5f-bbef-4a61-bc90-83e2df91f4d0',
  dev: '9275b4b9-2da3-4058-85f1-43aa5040f04c',
};
const DATASET = 'aramakisai_stamp_metrics';
const API = 'https://api.cloudflare.com/client/v4';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, string | number>;

const HOUR_MS = 3_600_000;
const JST_MS = 9 * HOUR_MS;
const GRAPHQL_LIMIT = 10_000;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + 'Z';
// 日本時間の [from 0 時, to 翌日 0 時) を UTC で表す
const utcRange = (from: string, to: string): [string, string] => [
  iso(Date.parse(from) - JST_MS),
  iso(Date.parse(to) + 24 * HOUR_MS - JST_MS),
];
const jstDate = (datetimeHour: string) =>
  new Date(Date.parse(datetimeHour) + JST_MS).toISOString().slice(0, 10);

const csv = (header: string[], rows: Row[]) =>
  [
    header.join(','),
    ...rows.map((r) => header.map((h) => r[h] ?? '').join(',')),
  ].join('\n') + '\n';

async function call(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  body: BodyInit,
  type: string,
) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
    body,
  });
  if (!res.ok)
    throw new Error(`Cloudflare API が失敗しました: HTTP ${res.status} ${url}`);
  return res.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// limit に達した応答は切り捨てられている可能性があるため黙って使わない
function checkLimit(rows: unknown[], what: string) {
  if (rows.length >= GRAPHQL_LIMIT)
    throw new Error(
      `${what} の取得件数が上限 ${GRAPHQL_LIMIT} に達しました。期間を短くしてください`,
    );
}

async function d1Rows(
  fetchImpl: typeof fetch,
  token: string,
  account: string,
  env: string,
  databaseId: string,
  from: string,
  to: string,
): Promise<Row[]> {
  const [utcFrom, utcTo] = utcRange(from, to);
  const group = (name: string, fields: string) =>
    `${name}(limit: ${GRAPHQL_LIMIT}, filter: {databaseId: "${databaseId}", datetimeHour_geq: "${utcFrom}", datetimeHour_lt: "${utcTo}"}) { dimensions { datetimeHour } ${fields} }`;
  const query = (g: string) =>
    JSON.stringify({
      query: `{ viewer { accounts(filter: {accountTag: "${account}"}) { ${g} } } }`,
    });
  const get = async (name: string, fields: string) => {
    const json = await call(
      fetchImpl,
      `${API}/graphql`,
      token,
      query(group(name, fields)),
      'application/json',
    );
    if (json.errors?.length)
      throw new Error(`GraphQL エラー: ${json.errors[0].message}`);
    const rows = (json.data.viewer.accounts[0][name] ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    checkLimit(rows, name);
    return rows;
  };
  const usage = await get(
    'd1AnalyticsAdaptiveGroups',
    'sum { readQueries writeQueries rowsRead rowsWritten queryBatchResponseBytes }',
  );
  const storage = await get(
    'd1StorageAdaptiveGroups',
    'max { databaseSizeBytes }',
  );
  const size = new Map<string, number>();
  for (const x of storage) {
    const d = jstDate(x.dimensions.datetimeHour);
    size.set(d, Math.max(size.get(d) ?? 0, x.max.databaseSizeBytes));
  }
  const days = new Map<string, Row>();
  for (const u of usage) {
    const d = jstDate(u.dimensions.datetimeHour);
    const cur = days.get(d) ?? {
      date: d,
      env,
      readQueries: 0,
      writeQueries: 0,
      rowsRead: 0,
      rowsWritten: 0,
      queryBatchResponseBytes: 0,
      databaseSizeBytes: size.get(d) ?? '',
    };
    for (const k of Object.keys(u.sum)) cur[k] = Number(cur[k]) + u.sum[k];
    days.set(d, cur);
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const HOSTS: Record<string, string> = {
  'aramakisai.com': 'prod',
  'dev.aramakisai.com': 'dev',
};
const MAX_DAYS = 30; // httpRequestsAdaptiveGroups の 1 クエリで取れる日数の上限
const DAY_MS = 86_400_000;

const staffEndpoint = (path: string) =>
  path === '/staff'
    ? 'staff_dashboard'
    : path === '/staff/exchanges'
      ? 'staff_exchanges'
      : path.startsWith('/staff/visitors/')
        ? 'staff_visitor'
        : null;

function windows(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  const end = Date.parse(to);
  for (let s = Date.parse(from); s <= end; s += MAX_DAYS * DAY_MS) {
    const e = Math.min(s + (MAX_DAYS - 1) * DAY_MS, end);
    out.push([
      new Date(s).toISOString().slice(0, 10),
      new Date(e).toISOString().slice(0, 10),
    ]);
  }
  return out;
}

async function staffPageRows(
  fetchImpl: typeof fetch,
  token: string,
  env: string | undefined,
  from: string,
  to: string,
): Promise<Row[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const zoneRes = await fetchImpl(`${API}/zones?name=aramakisai.com`, {
    headers,
  });
  if (!zoneRes.ok)
    throw new Error(
      `Cloudflare API が失敗しました: HTTP ${zoneRes.status} zones`,
    );
  const zoneId = ((await zoneRes.json()) as { result: { id: string }[] })
    .result[0]?.id;
  if (!zoneId) throw new Error('aramakisai.com の zone が見つかりません');

  const hosts = Object.keys(HOSTS).filter((h) => !env || HOSTS[h] === env);
  const sums = new Map<string, Row>();
  for (const [wFrom, wTo] of windows(from, to)) {
    const [utcFrom, utcTo] = utcRange(wFrom, wTo);
    const query = `{ viewer { zones(filter: {zoneTag: "${zoneId}"}) { httpRequestsAdaptiveGroups(limit: ${GRAPHQL_LIMIT}, filter: {datetimeHour_geq: "${utcFrom}", datetimeHour_lt: "${utcTo}", clientRequestHTTPHost_in: [${hosts.map((h) => `"${h}"`).join(',')}], clientRequestPath_like: "/staff%"}) { count dimensions { datetimeHour clientRequestHTTPHost clientRequestPath } sum { edgeResponseBytes } } } } }`;
    const json = await call(
      fetchImpl,
      `${API}/graphql`,
      token,
      JSON.stringify({ query }),
      'application/json',
    );
    if (json.errors?.length)
      throw new Error(`GraphQL エラー: ${json.errors[0].message}`);
    const groups = (json.data.viewer.zones[0]?.httpRequestsAdaptiveGroups ??
      []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    checkLimit(groups, 'httpRequestsAdaptiveGroups');
    for (const g of groups) {
      const date = jstDate(g.dimensions.datetimeHour);
      const e = HOSTS[g.dimensions.clientRequestHTTPHost];
      const endpoint = staffEndpoint(g.dimensions.clientRequestPath);
      if (!e || !endpoint || (env && e !== env)) continue;
      const key = `${date},${e},${endpoint}`;
      const cur = sums.get(key) ?? {
        date,
        env: e,
        endpoint,
        requests: 0,
        responseBytes: 0,
      };
      cur.requests = Number(cur.requests) + g.count;
      cur.responseBytes = Number(cur.responseBytes) + g.sum.edgeResponseBytes;
      sums.set(key, cur);
    }
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, r]) => r);
}

// responseBytes の -1 は未計測の印。SUM すると件数分の負数になり意味を失う
// _sample_interval で重み付けしないと AE のサンプリング時に件数・平均がずれる
const endpointSql = (from: string, to: string, env?: string) => {
  const [utcFrom, utcTo] = utcRange(from, to);
  return `SELECT
  formatDateTime(toStartOfInterval(timestamp + INTERVAL '9' HOUR, INTERVAL '1' DAY), '%Y-%m-%d') AS date, blob1 AS env, blob2 AS endpoint, blob3 AS outcome,
  SUM(_sample_interval) AS requests,
  SUM(_sample_interval * double1) AS requestBytes,
  if(MIN(double2) < 0, -1.0, SUM(_sample_interval * double2)) AS responseBytes,
  SUM(_sample_interval * double3) / SUM(_sample_interval) AS totalMsAvg,
  quantileWeighted(0.9)(double3, _sample_interval) AS totalMsP90,
  SUM(_sample_interval * double4) / SUM(_sample_interval) AS d1DurationMsAvg,
  SUM(_sample_interval * double5) AS rowsRead,
  SUM(_sample_interval * double6) AS rowsWritten,
  SUM(_sample_interval * double7) AS d1Failed
FROM ${DATASET}
WHERE timestamp >= toDateTime('${utcFrom.slice(0, 19).replace('T', ' ')}') AND timestamp < toDateTime('${utcTo.slice(0, 19).replace('T', ' ')}')${env ? ` AND blob1 = '${env}'` : ''}
GROUP BY date, env, endpoint, outcome
ORDER BY date, env, endpoint, outcome
FORMAT JSON`;
};

const hourlySql = (from: string, to: string, env?: string) => {
  const [utcFrom, utcTo] = utcRange(from, to);
  return `SELECT
  formatDateTime(toStartOfInterval(timestamp + INTERVAL '9' HOUR, INTERVAL '1' HOUR), '%Y-%m-%d') AS date,
  formatDateTime(toStartOfInterval(timestamp + INTERVAL '9' HOUR, INTERVAL '1' HOUR), '%H') AS hour,
  blob1 AS env, blob5 AS exhibitionId, blob6 AS category, blob3 AS outcome,
  SUM(_sample_interval) AS requests
FROM ${DATASET}
WHERE blob2 = 'verify' AND timestamp >= toDateTime('${utcFrom.slice(0, 19).replace('T', ' ')}') AND timestamp < toDateTime('${utcTo.slice(0, 19).replace('T', ' ')}')${env ? ` AND blob1 = '${env}'` : ''}
GROUP BY date, hour, env, exhibitionId, category, outcome
ORDER BY date, hour, env, exhibitionId, category, outcome
FORMAT JSON`;
};

export async function exportStampMetrics(
  argv: string[],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        from: { type: 'string' },
        to: { type: 'string' },
        out: { type: 'string' },
        env: { type: 'string' },
      },
    });
    const { from, to, out } = values;
    if (!from || !to || !out || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new Error(
        '--from YYYY-MM-DD --to YYYY-MM-DD --out <dir> は必須です',
      );
    }
    if (values.env && !DATABASES[values.env])
      throw new Error('--env は prod か dev です');
    const token = env.CLOUDFLARE_API_TOKEN;
    const account = env.CLOUDFLARE_ACCOUNT_ID;
    if (!token) throw new Error('CLOUDFLARE_API_TOKEN が未設定です');
    if (!account) throw new Error('CLOUDFLARE_ACCOUNT_ID が未設定です');

    const targets = Object.entries(DATABASES).filter(
      ([name]) => !values.env || name === values.env,
    );
    const d1: Row[] = [];
    for (const [name, id] of targets) {
      d1.push(...(await d1Rows(fetchImpl, token, account, name, id, from, to)));
    }
    const ae = await call(
      fetchImpl,
      `${API}/accounts/${account}/analytics_engine/sql`,
      token,
      endpointSql(from, to, values.env),
      'text/plain',
    );

    const hourly = await call(
      fetchImpl,
      `${API}/accounts/${account}/analytics_engine/sql`,
      token,
      hourlySql(from, to, values.env),
      'text/plain',
    );
    checkLimit(hourly.data, 'stamps_hourly');

    const staffPages = await staffPageRows(
      fetchImpl,
      token,
      values.env,
      from,
      to,
    );

    const dir = resolve(out);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'd1_daily.csv'),
      csv(
        [
          'date',
          'env',
          'rowsRead',
          'rowsWritten',
          'readQueries',
          'writeQueries',
          'queryBatchResponseBytes',
          'databaseSizeBytes',
        ],
        d1,
      ),
    );
    writeFileSync(
      join(dir, 'endpoints_daily.csv'),
      csv(
        [
          'date',
          'env',
          'endpoint',
          'outcome',
          'requests',
          'requestBytes',
          'responseBytes',
          'totalMsAvg',
          'totalMsP90',
          'd1DurationMsAvg',
          'rowsRead',
          'rowsWritten',
          'd1Failed',
        ],
        (ae.data as Row[]).map((r) => ({
          ...r,
          date: String(r.date).slice(0, 10),
        })),
      ),
    );
    writeFileSync(
      join(dir, 'stamps_hourly.csv'),
      csv(
        [
          'date',
          'hour',
          'env',
          'exhibitionId',
          'category',
          'outcome',
          'requests',
        ],
        hourly.data as Row[],
      ),
    );
    writeFileSync(
      join(dir, 'staff_pages_daily.csv'),
      csv(['date', 'env', 'endpoint', 'requests', 'responseBytes'], staffPages),
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1]?.endsWith('export-stamp-metrics.ts')) {
  void exportStampMetrics(process.argv.slice(2), process.env).then((code) => {
    process.exitCode = code;
  });
}
