import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// zxing-wasm は barcode-detector の推移的依存で pnpm ではトップレベルに出ない
const req = createRequire(
  createRequire(import.meta.url).resolve('barcode-detector'),
);
const dist = path.resolve(
  path.dirname(req.resolve('zxing-wasm/reader')),
  '../..',
);
const dest = 'public/vendor/zxing';
mkdirSync(dest, { recursive: true });
copyFileSync(
  path.join(dist, 'reader/zxing_reader.wasm'),
  `${dest}/zxing_reader.wasm`,
);
