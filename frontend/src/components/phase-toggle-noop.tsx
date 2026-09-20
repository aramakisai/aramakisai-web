// next.config.ts が DEV_OVERRIDE_ENABLED 偽のビルドで '@/components/phase-toggle'
// の解決先をこのファイルへ差し替える (build-time module substitution)。実行時の
// 条件分岐や next/dynamic による遅延分割では、本体 (Cookie 名や UI 文言を含む) の
// チャンク自体は成果物ディレクトリに残ってしまうため、import 解決先の置換で
// 本体そのものをバンドル対象から外す。
export function PhaseToggle(): null {
  return null;
}
