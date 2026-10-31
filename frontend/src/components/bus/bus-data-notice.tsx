import Link from 'next/link';
import { toJstParts } from '@/lib/event-day';

export interface BusDataNoticeProps {
  readonly timetableFetchedAt: string;
  /** epoch 秒。リアルタイム情報が無い・古くて使えないときは null */
  readonly realtimeGeneratedAt: number | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatFetchedAt(iso: string): string {
  const { year, month, date, hours, minutes } = toJstParts(iso);
  return `${year}/${pad2(month)}/${pad2(date)} ${pad2(hours)}:${pad2(minutes)}`;
}

function formatGeneratedAt(epochSec: number): string {
  const { hours, minutes } = toJstParts(
    new Date(epochSec * 1000).toISOString(),
  );
  // JST は UTC+9 で分単位に揃うため、秒は UTC と同じ
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(epochSec % 60)}`;
}

export function BusDataNotice({
  timetableFetchedAt,
  realtimeGeneratedAt,
}: BusDataNoticeProps) {
  return (
    <div
      data-testid="bus-data-notice"
      className="flex flex-col gap-1 text-xs leading-[1.6] text-gray-500 [word-break:break-word]"
    >
      <p>
        このサービスは、以下の著作物を改変して利用しています。関越交通株式会社、関越交通バス・【リアルタイム情報】関越交通バス、クリエイティブ・コモンズ・ライセンス　表示4.0国際(https://creativecommons.org/licenses/by/4.0/deed.ja)
      </p>
      <p>
        公共交通オープンデータセンターのデータを利用しています。データの正確性は保証されません。内容に関するお問い合わせは関越交通ではなく、
        <Link href="/contact" className="underline">
          お問い合わせページ
        </Link>
        へお願いします。
      </p>
      <p>時刻表の取得日時: {formatFetchedAt(timetableFetchedAt)}</p>
      {realtimeGeneratedAt !== null && (
        <p>遅延情報の生成時刻: {formatGeneratedAt(realtimeGeneratedAt)}</p>
      )}
    </div>
  );
}
