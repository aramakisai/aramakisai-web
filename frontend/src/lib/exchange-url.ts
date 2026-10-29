import { isVisitorId } from './visitor-id';

// 遷移先を相対パスで返すのは、読み取った文字列の origin を信用して遷移しないため
export function parseExchangeUrl(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const m = /^\/staff\/visitors\/([^/]+)$/.exec(url.pathname);
  if (!m || !isVisitorId(m[1]) || !url.searchParams.get('t')) return null;
  return `${url.pathname}${url.search}`;
}
