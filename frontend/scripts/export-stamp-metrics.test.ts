import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { exportStampMetrics } from './export-stamp-metrics';

const env = { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'acc' };
const args = (out: string) => [
  '--from',
  '2026-11-14',
  '--to',
  '2026-11-15',
  '--out',
  out,
  '--env',
  'dev',
];

function fakeFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/zones?name=')) {
      return Response.json({ result: [{ id: 'zone1' }] });
    }
    if (u.endsWith('/graphql')) {
      const q = JSON.parse(String(init?.body)).query as string;
      if (q.includes('httpRequestsAdaptiveGroups')) {
        const row = (host: string, path: string, count: number, b: number) => ({
          count,
          dimensions: {
            datetimeHour: '2026-11-14T03:00:00Z',
            clientRequestHTTPHost: host,
            clientRequestPath: path,
          },
          sum: { edgeResponseBytes: b },
        });
        return Response.json({
          data: {
            viewer: {
              zones: [
                {
                  httpRequestsAdaptiveGroups: [
                    row('dev.aramakisai.com', '/staff', 2, 100),
                    row('dev.aramakisai.com', '/staff', 1, 50),
                    row('dev.aramakisai.com', '/staff/exchanges', 4, 400),
                    row('dev.aramakisai.com', '/staff/visitors/abc', 3, 30),
                    row('dev.aramakisai.com', '/staff/scan', 9, 9),
                    row('dev.aramakisai.com', '/stamp', 9, 9),
                    row('aramakisai.com', '/staff', 7, 70),
                  ],
                },
              ],
            },
          },
        });
      }
      const sum = (n: number) => ({
        sum: {
          readQueries: n,
          writeQueries: n,
          rowsRead: n * 10,
          rowsWritten: n,
          queryBatchResponseBytes: n * 100,
        },
      });
      // 14:00Z と 15:00Z は日本時間で別の日になる
      const hours = q.includes('d1StorageAdaptiveGroups')
        ? [
            ['2026-11-14T03:00:00Z', { max: { databaseSizeBytes: 4096 } }],
            ['2026-11-14T10:00:00Z', { max: { databaseSizeBytes: 5000 } }],
            ['2026-11-14T14:00:00Z', { max: { databaseSizeBytes: 4500 } }],
            ['2026-11-14T15:00:00Z', { max: { databaseSizeBytes: 6000 } }],
          ]
        : [
            ['2026-11-14T03:00:00Z', sum(1)],
            ['2026-11-14T14:00:00Z', sum(2)],
            ['2026-11-14T15:00:00Z', sum(3)],
          ];
      const key = q.includes('d1StorageAdaptiveGroups')
        ? 'd1StorageAdaptiveGroups'
        : 'd1AnalyticsAdaptiveGroups';
      return Response.json({
        data: {
          viewer: {
            accounts: [
              {
                [key]: hours.map(([h, d]) => ({
                  dimensions: { datetimeHour: h },
                  ...(d as object),
                })),
              },
            ],
          },
        },
      });
    }
    const aeSql = String(init?.body);
    if (aeSql.includes('AS exhibitionId')) {
      return Response.json({
        data: [
          {
            date: '2026-11-14',
            hour: '13',
            env: 'dev',
            exhibitionId: '5',
            category: 'exhibit',
            outcome: 'added',
            requests: 7,
          },
        ],
      });
    }
    return Response.json({
      data: [
        {
          date: '2026-11-14 00:00:00',
          env: 'dev',
          endpoint: 'verify',
          outcome: 'added',
          requests: 10,
          requestBytes: 1200,
          responseBytes: 180,
          totalMsAvg: 30,
          totalMsP90: 55,
          d1DurationMsAvg: 12,
          rowsRead: 10,
          rowsWritten: 20,
          d1Failed: 0,
        },
      ],
    });
  });
}

describe('exportStampMetrics', () => {
  it('D1 とエンドポイント別の 2 つの CSV を出す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch();
    expect(
      await exportStampMetrics(args(out), env, f as unknown as typeof fetch),
    ).toBe(0);
    expect(readFileSync(join(out, 'd1_daily.csv'), 'utf8')).toBe(
      'date,env,rowsRead,rowsWritten,readQueries,writeQueries,queryBatchResponseBytes,databaseSizeBytes\n' +
        '2026-11-14,dev,30,3,3,3,300,5000\n' +
        '2026-11-15,dev,30,3,3,3,300,6000\n',
    );
    expect(readFileSync(join(out, 'endpoints_daily.csv'), 'utf8')).toBe(
      'date,env,endpoint,outcome,requests,requestBytes,responseBytes,totalMsAvg,totalMsP90,d1DurationMsAvg,rowsRead,rowsWritten,d1Failed\n' +
        '2026-11-14,dev,verify,added,10,1200,180,30,55,12,10,20,0\n',
    );
    expect(readFileSync(join(out, 'staff_pages_daily.csv'), 'utf8')).toBe(
      'date,env,endpoint,requests,responseBytes\n' +
        '2026-11-14,dev,staff_dashboard,3,150\n' +
        '2026-11-14,dev,staff_exchanges,4,400\n' +
        '2026-11-14,dev,staff_visitor,3,30\n',
    );
    const sql = f.mock.calls
      .map(([u, i]) => [String(u), String(i?.body)])
      .find(([u]) => u.includes('analytics_engine'))!;
    expect(sql[1]).toContain('aramakisai_stamp_metrics');
    expect(sql[1]).toContain(
      "toStartOfInterval(timestamp + INTERVAL '9' HOUR, INTERVAL '1' DAY)",
    );
    expect(sql[1]).toContain("timestamp >= toDateTime('2026-11-13 15:00:00')");
    expect(sql[1]).toContain("timestamp < toDateTime('2026-11-15 15:00:00')");
  });

  it('企画×時刻の stamps_hourly.csv と SQL を出す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch();
    await exportStampMetrics(args(out), env, f as unknown as typeof fetch);
    expect(readFileSync(join(out, 'stamps_hourly.csv'), 'utf8')).toBe(
      'date,hour,env,exhibitionId,category,outcome,requests\n' +
        '2026-11-14,13,dev,5,exhibit,added,7\n',
    );
    const sql = f.mock.calls
      .map(([, i]) => String(i?.body))
      .find((b) => b.includes('AS exhibitionId'))!;
    expect(sql).toContain(
      "toStartOfInterval(timestamp + INTERVAL '9' HOUR, INTERVAL '1' HOUR), '%H') AS hour",
    );
    expect(sql).toContain("blob2 = 'verify'");
    expect(sql).toContain('SUM(_sample_interval) AS requests');
    expect(sql).toContain('blob5 AS exhibitionId, blob6 AS category');
    expect(sql).toContain("timestamp >= toDateTime('2026-11-13 15:00:00')");
    expect(sql).toContain("AND blob1 = 'dev'");
    expect(sql).toContain(
      'GROUP BY date, hour, env, exhibitionId, category, outcome',
    );
  });

  it('日本時間の範囲を UTC の datetimeHour で問い合わせる', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch();
    await exportStampMetrics(args(out), env, f as unknown as typeof fetch);
    const bodies = f.mock.calls
      .map(([, i]) => String(i?.body))
      .filter((b) => b.includes('datetimeHour_geq'));
    expect(bodies.length).toBe(3);
    for (const b of bodies) {
      expect(b).toContain('datetimeHour_geq: \\"2026-11-13T15:00:00Z\\"');
      expect(b).toContain('datetimeHour_lt: \\"2026-11-15T15:00:00Z\\"');
    }
  });

  it('未計測の印 -1 を含む endpoint の responseBytes は合計せず -1 のまま出す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch();
    await exportStampMetrics(args(out), env, f as unknown as typeof fetch);
    const sql = String(
      f.mock.calls.find(([u]) => String(u).includes('analytics_engine'))![1]
        ?.body,
    );
    expect(sql).toContain(
      'if(MIN(double2) < 0, -1.0, SUM(_sample_interval * double2)) AS responseBytes',
    );
  });

  it('GraphQL の取得件数が上限に達したら 1 を返す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = vi.fn(async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                d1AnalyticsAdaptiveGroups: Array.from(
                  { length: 10000 },
                  () => ({
                    dimensions: { datetimeHour: '2026-11-14T03:00:00Z' },
                    sum: {},
                  }),
                ),
              },
            ],
          },
        },
      }),
    );
    expect(
      await exportStampMetrics(args(out), env, f as unknown as typeof fetch),
    ).toBe(1);
  });

  it('zone の問い合わせは 30 日以内の窓に分ける', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch();
    await exportStampMetrics(
      [
        '--from',
        '2026-10-01',
        '--to',
        '2026-11-15',
        '--out',
        out,
        '--env',
        'dev',
      ],
      env,
      f as unknown as typeof fetch,
    );
    const windows = f.mock.calls
      .map(([, i]) => String(i?.body))
      .filter((b) => b.includes('httpRequestsAdaptiveGroups'))
      .map((b) =>
        b
          .match(
            /datetimeHour_geq: \\"([\w:-]+)\\", datetimeHour_lt: \\"([\w:-]+)\\"/,
          )!
          .slice(1),
      );
    expect(windows).toEqual([
      ['2026-09-30T15:00:00Z', '2026-10-30T15:00:00Z'],
      ['2026-10-30T15:00:00Z', '2026-11-15T15:00:00Z'],
    ]);
  });

  it('トークン未設定・日付不正は 1 を返す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = fakeFetch() as unknown as typeof fetch;
    expect(await exportStampMetrics(args(out), {}, f)).toBe(1);
    expect(
      await exportStampMetrics(
        ['--from', 'x', '--to', '2026-11-15', '--out', out],
        env,
        f,
      ),
    ).toBe(1);
  });

  it('API が失敗したら 1 を返す', async () => {
    const out = mkdtempSync(join(tmpdir(), 'metrics-'));
    const f = vi.fn(async () => new Response('no', { status: 403 }));
    expect(
      await exportStampMetrics(args(out), env, f as unknown as typeof fetch),
    ).toBe(1);
  });
});
