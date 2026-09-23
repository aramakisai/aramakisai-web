import { toJstParts } from './event-day';

/**
 * 「2026年9月22日」の形式 (月・日はゼロ埋めしない) で表記する。お知らせ一覧・
 * お知らせ詳細など、公開日時の表記を共有する箇所から呼ぶ。
 */
export function formatFullDate(iso: string): string {
  const { year, month, date } = toJstParts(iso);
  return `${year}年${month}月${date}日`;
}
