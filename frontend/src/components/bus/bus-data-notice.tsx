import Link from 'next/link';
import { toJstParts } from '@/lib/event-day';

export interface BusDataNoticeProps {
  readonly timetableFetchedAt: string;
  readonly variant: 'page' | 'short';
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatFetchedAt(iso: string): string {
  const { year, month, date, hours, minutes } = toJstParts(iso);
  return `${year}/${pad2(month)}/${pad2(date)} ${pad2(hours)}:${pad2(minutes)}`;
}

export function BusDataNotice({
  timetableFetchedAt,
  variant,
}: BusDataNoticeProps) {
  if (variant === 'short') {
    return (
      <p data-testid="bus-data-notice" className="text-gray-600">
        データ: 関越交通(CC BY 4.0)・公共交通オープンデータセンター
      </p>
    );
  }
  return (
    <div
      data-testid="bus-data-notice"
      className="flex flex-col gap-1 text-xs leading-[1.6] text-gray-600 [word-break:break-word]"
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
    </div>
  );
}
