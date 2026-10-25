import { notFound } from 'next/navigation';

// ゲート時の rewrite 先。端末用の not-found.tsx を通すため touch 配下に置く
// (/gated は (site) のヘッダー・フッター付き、/gated-fullscreen はルートの
// not-found.tsx でトップへのリンクが出る)
export default function TouchGatedPage() {
  notFound();
}
