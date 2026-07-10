export interface WaitForPreviewOptions {
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
  maxAttempts: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

export type WaitForPreviewResult =
  | { status: 'reachable' }
  | { status: 'timeout'; attempts: number }
  | { status: 'access-denied'; httpStatus: number };

const ACCESS_DENIED_STATUSES = new Set([401, 403]);
const DEFAULT_RETRY_DELAY_MS = 2000;

export async function waitForPreview(
  options: WaitForPreviewOptions,
): Promise<WaitForPreviewResult> {
  const {
    url,
    headers,
    timeoutMs,
    maxAttempts,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    fetchImpl = fetch,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let attempts = 0;

  while (attempts < maxAttempts && Date.now() < deadline) {
    attempts += 1;

    try {
      const response = await fetchImpl(url, { headers });
      if (ACCESS_DENIED_STATUSES.has(response.status)) {
        return { status: 'access-denied', httpStatus: response.status };
      }
      if (response.ok) {
        return { status: 'reachable' };
      }
    } catch {
      // network error (unreachable, DNS failure, etc.): fall through to retry
    }

    if (attempts < maxAttempts && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return { status: 'timeout', attempts };
}

function parseAccessHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (clientId && clientSecret) {
    headers['CF-Access-Client-Id'] = clientId;
    headers['CF-Access-Client-Secret'] = clientSecret;
  }
  return headers;
}

async function main(): Promise<void> {
  const url = process.env.E2E_BASE_URL;
  if (!url) {
    console.error('E2E_BASE_URL is not set');
    process.exitCode = 1;
    return;
  }

  const maxAttempts = Number(process.env.WAIT_FOR_PREVIEW_MAX_ATTEMPTS ?? 20);
  const timeoutMs = Number(process.env.WAIT_FOR_PREVIEW_TIMEOUT_MS ?? 120_000);

  const result = await waitForPreview({
    url,
    headers: parseAccessHeaders(),
    timeoutMs,
    maxAttempts,
  });

  switch (result.status) {
    case 'reachable':
      console.log(`preview reachable: ${url}`);
      return;
    case 'access-denied':
      console.error(
        `blocked by Cloudflare Access (HTTP ${result.httpStatus}): ${url}`,
      );
      process.exitCode = 1;
      return;
    case 'timeout':
      console.error(
        `unreachable: timeout after ${result.attempts} attempt(s): ${url}`,
      );
      process.exitCode = 1;
      return;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
