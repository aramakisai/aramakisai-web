import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const CHANNELS = ['p2p', 'wolfxEew', 'wolfxEqlist'] as const;
type Channel = (typeof CHANNELS)[number];

export interface InjectArgs {
  url: string;
  channel: Channel;
  interval: number;
  files: string[];
}

export function parseInjectArgs(argv: string[]): InjectArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      channel: { type: 'string' },
      interval: { type: 'string', default: '1' },
    },
  });
  if (!values.url) throw new Error('--url が必要です');
  const channel = CHANNELS.find((c) => c === values.channel);
  if (!channel)
    throw new Error(`--channel は ${CHANNELS.join('|')} のいずれか`);
  if (positionals.length === 0)
    throw new Error('ファイルを1つ以上指定してください');
  const interval = Number(values.interval);
  if (!Number.isFinite(interval) || interval < 0)
    throw new Error('--interval は0以上の秒数');
  return {
    url: values.url.replace(/\/$/, ''),
    channel,
    interval,
    files: positionals,
  };
}

export interface InjectDeps {
  token: string | undefined;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  read: (file: string) => string;
}

export async function injectFiles(
  args: InjectArgs,
  deps: InjectDeps,
): Promise<void> {
  if (!deps.token) throw new Error('SIGNAGE_QUAKE_TOKEN が未設定です');
  for (const [i, file] of args.files.entries()) {
    if (i > 0) await deps.sleep(args.interval * 1000);
    const res = await deps.fetch(`${args.url}/dev/inject/${args.channel}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.token}` },
      body: deps.read(file),
    });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    console.log(`${file}: ${res.status === 204 ? '受理' : '無視された'}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  injectFiles(parseInjectArgs(process.argv.slice(2)), {
    token: process.env.SIGNAGE_QUAKE_TOKEN,
    fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    read: (file) => readFileSync(file, 'utf8'),
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
