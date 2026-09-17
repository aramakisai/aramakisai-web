export type CmsCheckResult =
  { status: 'ok' } | { status: 'cms-dependency-error'; detail: string };

export async function checkCmsReachable(
  baseUrl: string,
  collection: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CmsCheckResult> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/${collection}?limit=1`);
    if (!response.ok) {
      return {
        status: 'cms-dependency-error',
        detail: `HTTP error: ${response.status} ${response.statusText}`,
      };
    }
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'cms-dependency-error',
      detail: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
