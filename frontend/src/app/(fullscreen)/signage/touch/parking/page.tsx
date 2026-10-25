import { TouchParkingList } from '@/components/signage/touch/touch-parking-list';
import { getParkingResponse } from '@/lib/parking-data';

// 空き状況は常に最新を返す必要があり、ダミー CMS のビルドで事前描画させない
export const dynamic = 'force-dynamic';

export default async function TouchParkingPage() {
  const result = await getParkingResponse();
  return (
    <TouchParkingList
      initial={result.ok ? result.value : null}
      renderedAt={new Date().toISOString()}
    />
  );
}
