import { readFileSync, writeFileSync } from 'node:fs';

// frontend は payload を依存に持たないため、payload モジュール拡張だけ落として取り込む
const source = readFileSync(new URL('../src/payload-types.ts', import.meta.url), 'utf8');
const stripped = source.replace(/\ndeclare module 'payload' \{[\s\S]*?\n\}\n?$/, '\n');

writeFileSync(new URL('../../frontend/src/cms-types.ts', import.meta.url), stripped);
console.log('synced cms types to frontend/src/cms-types.ts');
