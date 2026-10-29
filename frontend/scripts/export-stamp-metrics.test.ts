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
            date: '2026-11-14',
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
      const data = q.includes('d1StorageAdaptiveGroups')
        ? { max: { databaseSizeBytes: 4096 } }
        : {
            sum: {
              readQueries: 3,
              writeQueries: 2,
              rowsRead: 30,
              rowsWritten: 4,
              queryBatchResponseBytes: 999,
            },
          };
      const key = q.includes('d1StorageAdaptiveGroups')
        ? 'd1StorageAdaptiveGroups'
        : 'd1AnalyticsAdaptiveGroups';
      return Response.json({
        data: {
          viewer: {
            accounts: [
              { [key]: [{ dimensions: { date: '2026-11-14' }, ...data }] },
            ],
          },
        },
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
        '2026-11-14,dev,30,4,3,2,999,4096\n',
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
    expect(sql[1]).toContain('2026-11-14');
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
        b.match(/date_geq: \\"([\d-]+)\\", date_leq: \\"([\d-]+)\\"/)!.slice(1),
      );
    expect(windows).toEqual([
      ['2026-10-01', '2026-10-30'],
      ['2026-10-31', '2026-11-15'],
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
