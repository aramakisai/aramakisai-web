import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import {
  STAMP_CATEGORIES,
  signStamp,
  type StampCategory,
} from '../src/lib/stamp-signature';

interface Doc {
  id: number;
  status: string;
  organization_name?: string | null;
  categories: string[];
  [category: string]: unknown;
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

async function build(
  siteUrl: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  dir: string,
) {
  const {
    STAMP_SIGNING_SECRET: secret,
    NEXT_PUBLIC_CMS_URL: cms,
    CMS_AUTH_TOKEN: token,
  } = env;
  if (!secret) throw new Error('STAMP_SIGNING_SECRET が未設定です');
  if (!cms) throw new Error('NEXT_PUBLIC_CMS_URL が未設定です');
  if (!token) throw new Error('CMS_AUTH_TOKEN が未設定です');

  const res = await fetchImpl(
    `${cms}/api/student_exhibitions?limit=0&depth=0`,
    {
      headers: { Authorization: `JWT ${token}` },
    },
  );
  if (!res.ok) throw new Error(`CMS の取得に失敗しました: HTTP ${res.status}`);
  const { docs } = (await res.json()) as { docs: Doc[] };

  const rows = ['id,category,name,organization,status,url'];
  for (const doc of docs) {
    for (const category of STAMP_CATEGORIES) {
      if (!doc.categories.includes(category)) continue;
      const url = `${siteUrl.replace(/\/$/, '')}/exhibitions/${doc.id}/${category}#s=${await signStamp(secret, doc.id, category as StampCategory)}`;
      writeFileSync(
        `${dir}/${doc.id}-${category}.svg`,
        await QRCode.toString(url, { type: 'svg' }),
      );
      const name =
        (doc[category] as { name?: string | null } | undefined)?.name ?? '';
      rows.push(
        [
          doc.id,
          category,
          csvCell(name),
          csvCell(doc.organization_name ?? ''),
          doc.status === 'published' ? '公開' : '下書き',
          url,
        ].join(','),
      );
    }
  }
  writeFileSync(`${dir}/index.csv`, rows.join('\n') + '\n');
}

export async function generateExhibitionQr(
  argv: string[],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let tmp: string | undefined;
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        'site-url': { type: 'string' },
        out: { type: 'string', default: 'qr-output' },
      },
    });
    if (!values['site-url']) throw new Error('--site-url は必須です');
    const out = resolve(values.out as string);
    // rename を同一ファイルシステム内で行うため出力先の隣に作る
    tmp = mkdtempSync(`${out}-tmp-`);
    await build(values['site-url'], env, fetchImpl, tmp);
    rmSync(out, { recursive: true, force: true });
    renameSync(tmp, out);
    tmp = undefined;
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('generate-exhibition-qr.ts')) {
  // tsx は cjs 出力のため top-level await が使えない
  void generateExhibitionQr(process.argv.slice(2), process.env).then((code) => {
    process.exitCode = code;
  });
}
