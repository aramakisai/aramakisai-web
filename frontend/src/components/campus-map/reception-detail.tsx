import type { CampusMapPoint } from '@/lib/campus-map';

export function ReceptionDetail({
  point,
  pamphletUrl,
  onClose,
}: {
  point: CampusMapPoint;
  pamphletUrl?: string | null;
  onClose: () => void;
}) {
  const comedy =
    point.receptionType === 'comedy' || point.label?.includes('お笑いライブ');
  return (
    <div className="flex flex-col gap-4 text-text" aria-live="polite">
      <button type="button" onClick={onClose} className="self-start underline">
        戻る
      </button>
      <h2 className="text-2xl font-bold">
        {comedy
          ? point.label?.replace('専用受付', '受付') ||
            'ママタルトお笑いライブ受付'
          : '受付'}
      </h2>
      {point.testData && <p>プレビュー用テストデータ</p>}
      {comedy ? (
        <>
          {point.eventUrl && (
            <a className="text-blue-700 underline" href={point.eventUrl}>
              お笑いライブの詳細を見る
            </a>
          )}
          {point.posterUrl && (
            <a
              href={point.posterUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start"
            >
              <img
                src={point.posterUrl}
                alt="お笑いライブのポスター"
                className="h-auto max-h-[22vh] max-w-full object-contain sm:max-h-[30vh]"
              />
            </a>
          )}
        </>
      ) : (
        <>
          <p>こちらの受付では、荒牧祭のパンフレットを配布しています。</p>
          {pamphletUrl && (
            <a className="text-blue-700 underline" href={pamphletUrl}>
              デジタルパンフレットを見る
            </a>
          )}
        </>
      )}
    </div>
  );
}
