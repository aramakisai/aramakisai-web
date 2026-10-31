import { cms } from './cms';

export interface AccessSettings {
  /** トップページの案内文 */
  readonly summary: string;
  /** アクセスページの本文 (HTML) */
  readonly contentHtml: string;
  readonly embedUrl: string | null;
  readonly embedHeight: number | null;
}

/** 取得失敗はページ全体を落とさず空の設定として扱う */
export async function getAccessSettings(): Promise<AccessSettings> {
  const result = await cms.findGlobal('site_settings');
  const s = result.ok ? result.value : null;
  return {
    summary: s?.access_summary ?? '',
    contentHtml: s?.access_content_html ?? '',
    embedUrl: s?.access_embed_url ?? null,
    embedHeight: s?.access_embed_height ?? null,
  };
}
