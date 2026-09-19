import { open, stat } from 'node:fs/promises';

const PBF_MAGIC = 'OSMHeader';
const MAGIC_SCAN_BYTES = 64;
// Geofabrik は存在しないパスへのリクエストも 200 でトップページ (数十KB) を返す。
// リージョン単位の実データは常に数百MBあるため、この閾値で誤取得を検出できる。
export const MIN_EXPECTED_BYTES = 10 * 1024 * 1024;

export interface OsmDownloadCheckResult {
  readonly sizeBytes: number;
  readonly hasPbfMagic: boolean;
}

export async function checkOsmDownload(
  filePath: string,
): Promise<OsmDownloadCheckResult> {
  const fileStat = await stat(filePath);
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(MAGIC_SCAN_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MAGIC_SCAN_BYTES, 0);
    return {
      sizeBytes: fileStat.size,
      hasPbfMagic: buffer.subarray(0, bytesRead).includes(PBF_MAGIC),
    };
  } finally {
    await handle.close();
  }
}

export function describeDownloadFailure(
  result: OsmDownloadCheckResult,
  minBytes: number = MIN_EXPECTED_BYTES,
): string | null {
  if (result.sizeBytes < minBytes) {
    return `ダウンロードされたファイルが小さすぎます (${result.sizeBytes} bytes)。Geofabrik がエラーページ (HTML) を返している可能性があります。`;
  }
  if (!result.hasPbfMagic) {
    return 'ダウンロードされたファイルに OSM PBF のヘッダーが見つかりません。破損しているか、PBF 以外のデータが保存されています。';
  }
  return null;
}

async function main(): Promise<void> {
  const filePath = process.env.OSM_PBF_PATH;
  if (!filePath) {
    console.error('OSM_PBF_PATH が未設定です。');
    process.exitCode = 1;
    return;
  }

  const result = await checkOsmDownload(filePath);
  console.log(`サイズ: ${(result.sizeBytes / 1024 / 1024).toFixed(2)}MB`);

  const failure = describeDownloadFailure(result);
  if (failure) {
    console.error(failure);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
