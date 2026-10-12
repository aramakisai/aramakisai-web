import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { signStamp } from '../src/lib/stamp-signature';
import { generateExhibitionQr } from './generate-exhibition-qr';

const SECRET = 'test-secret-test-secret-test-secret-0123';
const docs = [
  {
    id: 1,
    status: 'published',
    organization_name: '団体A',
    categories: ['exhibit', 'stage'],
    exhibit: { name: '展示A' },
  },
  {
    id: 2,
    status: 'draft',
    organization_name: '団体,B',
    categories: ['vendor', 'other'],
    vendor: { name: '模擬店"B"' },
    other: { name: 'その他B' },
  },
  {
    id: 3,
    status: 'published',
    organization_name: '団体C',
    categories: ['stage'],
    stage: { name: 'ステージC' },
  },
];

function setup(response: Response | Error) {
  const out = join(mkdtempSync(join(tmpdir(), 'qr-')), 'out');
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
  const run = (env: Record<string, string | undefined> = {}) =>
    generateExhibitionQr(
      ['--site-url', 'https://example.com', '--out', out],
      {
        STAMP_SIGNING_SECRET: SECRET,
        NEXT_PUBLIC_CMS_URL: 'https://cms.test',
        CMS_AUTH_TOKEN: 'tok',
        ...env,
      },
      fetchImpl,
    );
  return { out, run, fetchImpl };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('generateExhibitionQr', () => {
  it('stage を除き下書きを含む組ごとに SVG と index.csv を出す', async () => {
    const { out, run, fetchImpl } = setup(json({ docs }));
    expect(await run()).toBe(0);
    expect(readdirSync(out).sort()).toEqual([
      '1-exhibit.svg',
      '2-other.svg',
      '2-vendor.svg',
      'index.csv',
    ]);
    expect(readFileSync(join(out, '1-exhibit.svg'), 'utf8')).toContain('<svg');
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(String(url)).toBe(
      'https://cms.test/api/student_exhibitions?limit=0&depth=0',
    );
    expect(init.headers.Authorization).toBe('JWT tok');
    const sig = await signStamp(SECRET, 2, 'vendor');
    const csv = readFileSync(join(out, 'index.csv'), 'utf8');
    expect(csv).toContain(
      `2,vendor,"模擬店""B""","団体,B",下書き,https://example.com/exhibitions/2/vendor#s=${sig}`,
    );
    expect(csv).not.toContain('stage');
  });

  it.each([
    ['CMS が 401', json({}, 401), {}],
    ['CMS が 500', json({}, 500), {}],
    ['ネットワーク失敗', new Error('down'), {}],
    ['秘密値未設定', json({ docs }), { STAMP_SIGNING_SECRET: '' }],
    ['トークン未設定', json({ docs }), { CMS_AUTH_TOKEN: '' }],
  ])('%s のとき終了コード1で出力先を変えない', async (_n, res, env) => {
    const { out, run } = setup(res);
    mkdirSync(out);
    writeFileSync(join(out, 'keep.txt'), 'old');
    expect(await run(env)).toBe(1);
    expect(readdirSync(out)).toEqual(['keep.txt']);
  });

  it('--site-url が無ければ終了コード1', async () => {
    const { fetchImpl } = setup(json({ docs }));
    expect(
      await generateExhibitionQr(
        [],
        { STAMP_SIGNING_SECRET: SECRET },
        fetchImpl,
      ),
    ).toBe(1);
  });
});
