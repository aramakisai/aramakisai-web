export type DirectusCheckResult =
  { status: 'ok' } | { status: 'directus-dependency-error'; detail: string };

export async function checkDirectusReachable(
  baseUrl: string,
  collection: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DirectusCheckResult> {
  try {
    const response = await fetchImpl(`${baseUrl}/items/${collection}?limit=1`);
    if (!response.ok) {
      return {
        status: 'directus-dependency-error',
        detail: `HTTP error: ${response.status} ${response.statusText}`,
      };
    }
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'directus-dependency-error',
      detail: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
