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
    if (u.endsWith('/graphql')) {
      const q = JSON.parse(String(init?.body)).query as string;
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
    const sql = f.mock.calls
      .map(([u, i]) => [String(u), String(i?.body)])
      .find(([u]) => u.includes('analytics_engine'))!;
    expect(sql[1]).toContain('aramakisai_stamp_metrics');
    expect(sql[1]).toContain('2026-11-14');
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
