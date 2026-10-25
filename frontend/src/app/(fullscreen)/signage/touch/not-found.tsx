// ルートの not-found.tsx は「トップページに戻る」リンクを出すため使わない
export default function TouchNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p className="text-signage-body">ページが見つかりません</p>
    </main>
  );
}
