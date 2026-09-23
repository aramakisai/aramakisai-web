/**
 * ローカル開発用シード: announcements / topics / sponsors / festival_meta / pages に
 * フロントエンドのデザイン確認に足る件数・バリエーションを投入する。
 *
 * 実行例:
 *   DATABASE_URL=postgresql://payload:payload@localhost:5433/payload \
 *   PAYLOAD_SECRET=local-test-secret \
 *   NODE_OPTIONS=--import=tsx/esm node scripts/seed-dev-content.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical';
import { JSDOM } from 'jsdom';
import { getPayload, type Payload } from 'payload';

import configPromise from '../src/payload.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFilesDir = path.resolve(dirname, '../seed/files');

// 本番 DB を誤爆しないための必須ガード。infisical --env=prod 経由の実行は接続先が
// localhost:5433 にならないため、ここで弾かれる。
function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL ?? '';
  const url = new URL(raw);
  if (url.hostname !== 'localhost' || url.port !== '5433') {
    throw new Error(
      `DATABASE_URL の接続先が localhost:5433 ではない (${url.hostname}:${url.port})。` +
        '本番/staging への誤投入を避けるため中断する。',
    );
  }
}

// seed-dev-exhibitions.ts の media (alt: シード用写真*) と衝突しないよう別プレフィックスにし、
// このスクリプトの再実行時は自分がアップロードした分だけを削除範囲にする。
const MEDIA_ALT_PREFIX = 'コンテンツシード用';

// 実ファイルの中身は PNG と PDF が混在している (ファイル名の UUID からは判別不可)。
// image フィールド (サムネイル/ロゴ/本文埋め込み) には PNG のみを使う。
const MEDIA_IMAGE_FILES = [
  '7bc0ee32-05b5-4cf6-80ba-a5a8d97b2da4',
  '8910f907-7ed0-48c1-a528-37b192c7bf81',
  '9a879200-cf00-4614-8a59-a29c56dcbd79',
  'f8dac7bd-32eb-4df3-845d-a296ca1730a7',
] as const;
const MEDIA_PDF_FILES = [
  '87420f27-3979-430e-a53e-c745ebece696',
  'a2edf49b-ac83-4d21-b47f-07b4907bd42d',
] as const;

// announcements/topics/sponsors はこのスクリプトが唯一のローカル投入元という前提で、
// 再実行のたびに全削除してから作り直す (件数の増殖を防ぐ)。media は先にこれらを削除して
// 参照を切ってから、alt プレフィックスで自スコープ分だけ削除する。
async function resetPreviousSeed(payload: Payload): Promise<void> {
  const all = { id: { exists: true } };
  await payload.delete({ collection: 'announcements', where: all });
  await payload.delete({ collection: 'topics', where: all });
  await payload.delete({ collection: 'sponsors', where: all });
  await payload.delete({ collection: 'media', where: { alt: { like: MEDIA_ALT_PREFIX } } });
}

// 有効なリッチテキスト機能 (rich-text-editor.ts) を一通り含む本文。img は
// convertHTMLToLexical が data-lexical-upload-* 属性から upload ノードへ変換する。
function fullFeaturedBodyHtml(mediaId: number, heading: string): string {
  return `
    <h2>${heading}の見どころ</h2>
    <p>これは <strong>太字</strong>・<em>斜体</em>・<u>下線</u>・<s>取消線</s> を含む段落です。詳細は<a href="https://example.com/seed">公式サイト</a>をご覧ください。</p>
    <h3>当日の流れ</h3>
    <ul>
      <li>受付開始</li>
      <li>企画本編
        <ul>
          <li>前半パート</li>
          <li>後半パート</li>
        </ul>
      </li>
    </ul>
    <h4>持ち物</h4>
    <ol>
      <li>学生証</li>
      <li>雨具 (荒天時)</li>
    </ol>
    <blockquote>今年も皆様のご来場をお待ちしております。</blockquote>
    <img data-lexical-upload-relation-to="media" data-lexical-upload-id="${mediaId}">
    <hr>
    <p>ご不明点は実行委員会までお問い合わせください。</p>
  `;
}

function simpleBodyHtml(text: string): string {
  return `<p>${text}</p>`;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const ANNOUNCEMENT_TITLES = [
  '第45回荒牧祭 開催のお知らせ',
  '来場に関するお願い',
  '駐輪場のご案内',
  'タイムテーブルを公開しました',
  'ボランティアスタッフ募集',
  '荒天時の対応について',
  '模擬店の出店企画一覧を公開',
  'ステージ企画の見どころ紹介',
  '構内飲食禁止エリアについて',
  '喫煙所の設置場所について',
  'ペット同伴に関するお願い',
  '会場までのアクセス方法',
  '前日準備のスケジュール',
  '荒牧祭Tシャツ販売のお知らせ',
  'スタンプラリー企画のご案内',
  '献血キャンペーン実施のお知らせ',
  'キャッシュレス決済対応店舗一覧',
  '落とし物・忘れ物センターの設置',
  '駐車場満車時の迂回案内',
  'AED設置場所のご案内',
  '喫茶部企画の営業時間変更',
  '写真撮影・SNS投稿に関するお願い',
  '荒牧祭終了のご挨拶',
  '協賛企業様への御礼',
  '来年度実行委員募集のお知らせ',
] as const;

const TOPIC_TITLES = [
  'ダンス部が贈るステージ企画特集',
  '模擬店グルメ食べ歩きガイド',
  '軽音楽部ライブ直前インタビュー',
  '美術部作品展の見どころ',
  '実行委員が選ぶおすすめ企画5選',
  '荒牧祭の歴史を振り返る',
  'フォトスポット完全ガイド',
  '地域協賛店とのコラボ企画',
] as const;

async function main() {
  assertLocalDatabase();

  const payload = await getPayload({ config: configPromise });
  const editorConfig = await editorConfigFactory.default({ config: payload.config });
  // convertHTMLToLexical は data-lexical-upload-id を DOM 属性 (文字列) のまま upload
  // ノードの value に入れるが、postgres アダプタの media.id は数値のため文字列のままだと
  // 「有効なアップロードIDではありません」で保存時に弾かれる。数値に変換してから渡す。
  function coerceUploadIds<T>(node: T): T {
    if (Array.isArray(node)) return node.map(coerceUploadIds) as T;
    if (node !== null && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) next[k] = coerceUploadIds(v);
      if (next.type === 'upload' && typeof next.value === 'string' && /^\d+$/.test(next.value)) {
        next.value = Number(next.value);
      }
      return next as T;
    }
    return node;
  }
  const toLexical = (html: string) => coerceUploadIds(convertHTMLToLexical({ editorConfig, html, JSDOM }));

  await resetPreviousSeed(payload);

  // 1. media (画像・PDFそれぞれ実際の mimetype に合わせてアップロードする)
  async function uploadMedia(fileId: string, altSuffix: string, mimetype: string, ext: string): Promise<number> {
    const buffer = fs.readFileSync(path.join(seedFilesDir, fileId));
    const created = await payload.create({
      collection: 'media',
      data: { alt: `${MEDIA_ALT_PREFIX}${altSuffix}` },
      file: { data: buffer, mimetype, name: `content-seed-${altSuffix}.${ext}`, size: buffer.length },
    });
    return created.id as number;
  }
  const imageMediaIds: number[] = [];
  for (const [i, fileId] of MEDIA_IMAGE_FILES.entries()) {
    imageMediaIds.push(await uploadMedia(fileId, `image-${i + 1}`, 'image/png', 'png'));
  }
  const pdfMediaIds: number[] = [];
  for (const [i, fileId] of MEDIA_PDF_FILES.entries()) {
    pdfMediaIds.push(await uploadMedia(fileId, `pdf-${i + 1}`, 'application/pdf', 'pdf'));
  }
  console.log(`media: ${imageMediaIds.length + pdfMediaIds.length} 件作成 (画像${imageMediaIds.length}/PDF${pdfMediaIds.length})`);

  // 2. announcements (25件、日付分散・添付混在・網羅本文2件)
  for (const [i, title] of ANNOUNCEMENT_TITLES.entries()) {
    const isFullFeatured = i < 2;
    const hasAttachment = i % 3 === 0;
    await payload.create({
      collection: 'announcements',
      data: {
        title,
        body: toLexical(
          isFullFeatured
            ? fullFeaturedBodyHtml(imageMediaIds[i % imageMediaIds.length]!, title)
            : simpleBodyHtml(`${title}に関する詳細情報です (シードデータ)。`),
        ),
        published_at: daysAgoIso(i * 3 + 1),
        attachments: hasAttachment
          ? [pdfMediaIds[i % pdfMediaIds.length]!, imageMediaIds[i % imageMediaIds.length]!]
          : undefined,
      },
    });
  }
  console.log(`announcements: ${ANNOUNCEMENT_TITLES.length} 件作成`);

  // 3. topics (8件、全件サムネイル付き・網羅本文2件)
  for (const [i, title] of TOPIC_TITLES.entries()) {
    const isFullFeatured = i < 2;
    await payload.create({
      collection: 'topics',
      data: {
        title,
        body: toLexical(
          isFullFeatured
            ? fullFeaturedBodyHtml(imageMediaIds[i % imageMediaIds.length]!, title)
            : simpleBodyHtml(`${title}についてのシード本文です。`),
        ),
        image: imageMediaIds[i % imageMediaIds.length]!,
        published_at: daysAgoIso(i * 4 + 1),
        sort: i + 1,
      },
    });
  }
  console.log(`topics: ${TOPIC_TITLES.length} 件作成`);

  // 4. sponsors (12件、複数種別2件以上・全件ロゴ付き)
  const SPONSORS = [
    { name: 'アラマキ電機株式会社', type: ['ad'], tier: 'planA' },
    { name: '荒牧信用金庫', type: ['ad'], tier: 'planB' },
    { name: '△△不動産グループ', type: ['ad', 'local'], tier: 'planA', businessCategory: '不動産', address: '群馬県前橋市荒牧町1-1' },
    { name: '荒牧商店会', type: ['local'], businessCategory: '商店会', address: '群馬県前橋市荒牧町2-3' },
    { name: 'まちの八百屋 みどり', type: ['local'], businessCategory: '青果店', address: '群馬県前橋市荒牧町3-5' },
    { name: 'たい焼き本舗', type: ['vendor'] },
    { name: '唐揚げ専門店 からりん', type: ['vendor'] },
    { name: '地域清掃ボランティア団体', type: ['other'] },
    { name: '荒牧サポーターズクラブ', type: ['other'] },
    { name: '県内工務店ネットワーク', type: ['local', 'vendor'], businessCategory: '建設業', address: '群馬県前橋市荒牧町4-8' },
    { name: 'フードトラックA', type: ['vendor'] },
    { name: '総合スポンサーX株式会社', type: ['ad', 'other'], tier: 'planC' },
  ] as const;
  for (const [i, s] of SPONSORS.entries()) {
    await payload.create({
      collection: 'sponsors',
      data: {
        type: [...s.type],
        name: s.name,
        logo: imageMediaIds[i % imageMediaIds.length]!,
        url: `https://example.com/seed/sponsor-${i + 1}`,
        description: `${s.name}様からのご協賛メッセージです (シードデータ)。`,
        business_category: 'businessCategory' in s ? s.businessCategory : undefined,
        address: 'address' in s ? s.address : undefined,
        tier: 'tier' in s ? s.tier : undefined,
        sort: i + 1,
      },
    });
  }
  console.log(`sponsors: ${SPONSORS.length} 件作成`);

  // 5. festival_meta (カウントダウン表示のため常に未来日になるよう実行時刻起点で算出する)
  const startAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const endAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  const dayAfter = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  // name は required のため、初期状態 (未設定) のローカル DB では event_days/access_summary
  // だけの部分更新がバリデーションで弾かれる。既に値がある場合は上書きしない。
  const currentFestivalMeta = await payload.findGlobal({ slug: 'festival_meta' });
  await payload.updateGlobal({
    slug: 'festival_meta',
    data: {
      name: currentFestivalMeta.name ?? '荒牧祭',
      event_days: [
        { start_at: startAt.toISOString(), end_at: endAt.toISOString(), label: '1日目' },
        { start_at: endAt.toISOString(), end_at: dayAfter.toISOString(), label: '2日目' },
      ],
      access_summary:
        '群馬大学荒牧キャンパスまでは、JR前橋駅からバスで約20分、上毛電鉄中央前橋駅から徒歩約25分です。当日は臨時駐車場もご利用いただけます。',
    },
  });
  console.log('festival_meta 更新');

  // 6. pages (既存分はスキップし、不足分のみ最小構成で作成する)
  const PAGES = [
    { slug: 'guidelines', title: '来場ガイドライン', content: '<p>来場にあたってのお願い事項です (シードデータ)。</p>', sort: 1 },
    { slug: 'info-desk', title: '総合案内所', content: '<p>総合案内所の場所と対応内容です (シードデータ)。</p>', sort: 2 },
    { slug: 'waste', title: 'ゴミの分別について', content: '<p>会場内のゴミ分別ルールです (シードデータ)。</p>', sort: 3 },
  ] as const;
  const existingPages = await payload.find({
    collection: 'pages',
    where: { slug: { in: PAGES.map((p) => p.slug) } },
    limit: PAGES.length,
  });
  const existingSlugs = new Set(existingPages.docs.map((d) => d.slug));
  for (const p of PAGES) {
    if (existingSlugs.has(p.slug)) {
      console.log(`pages: ${p.slug} は既存のためスキップ`);
      continue;
    }
    await payload.create({
      collection: 'pages',
      data: { slug: p.slug, title: p.title, content: toLexical(p.content), sort: p.sort },
    });
    console.log(`pages: ${p.slug} 作成`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
