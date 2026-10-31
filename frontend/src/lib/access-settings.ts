import { cms } from './cms';

export interface AccessSettings {
  /** トップページの案内文 */
  readonly summary: string;
  /** アクセスページの本文 (HTML) */
  readonly contentHtml: string;
  readonly embedUrl: string | null;
  readonly embedHeight: number | null;
}

export async function getAccessSettings(): Promise<AccessSettings> {
  const result = await cms.findGlobal('site_settings');
  if (!result.ok) throw new Error('アクセス設定の取得に失敗しました');
  const s = result.value;
  return {
    summary: s.access_summary ?? '',
    contentHtml: s.access_content_html ?? '',
    embedUrl: s.access_embed_url ?? null,
    embedHeight: s.access_embed_height ?? null,
  };
}
