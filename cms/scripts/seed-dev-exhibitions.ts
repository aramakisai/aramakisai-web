/**
 * ローカル開発用シード: 企画一覧・詳細ページのプレビューに必要な student_exhibitions を
 * 大量投入する。owner は 1 ユーザー 1 レコードの UNIQUE 制約があるため、レコードごとに
 * ダミーの student_exhibitor ユーザーを新規作成する。
 *
 * 実行例:
 *   DATABASE_URL=postgresql://payload:payload@localhost:5433/payload \
 *   PAYLOAD_SECRET=local-test-secret \
 *   NODE_OPTIONS=--import=tsx/esm node scripts/seed-dev-exhibitions.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const SEED_EMAIL_PREFIX = 'seed-exhibitor-';

// 2 回目以降の実行でも新しいマップエリア座標を反映できるよう、前回シードした分を全削除してから
// 入れ直す。参照先を先に消す必要がある (performance_slots → student_exhibitions/stages →
// map_areas/media/users の順)。ローカル専用データのみを対象にするため assertLocalDatabase() の
// 後でのみ呼び出すこと。
async function resetPreviousSeed(payload: Payload): Promise<void> {
  const already = await payload.find({
    collection: 'users',
    where: { email: { like: SEED_EMAIL_PREFIX } },
    limit: 1,
  });
  if (already.docs.length === 0) return;

  console.log('既存のシードデータを検出したため、削除してから再投入する。');
  const all = { id: { exists: true } };
  await payload.delete({ collection: 'performance_slots', where: all });
  await payload.delete({ collection: 'student_exhibitions', where: all });
  await payload.delete({ collection: 'stages', where: all });
  await payload.delete({ collection: 'time_slots', where: all });
  await payload.delete({ collection: 'map_areas', where: all });
  // media は他のシードスクリプトとも共有されるコレクションのため、全削除すると
  // seed-dev-content.ts がアップロードした media を巻き込んで消してしまう。
  // alt プレフィックスでこのスクリプト自身が作った分だけに絞る。
  await payload.delete({ collection: 'media', where: { alt: { like: 'シード用写真' } } });
  await payload.delete({ collection: 'users', where: { email: { like: SEED_EMAIL_PREFIX } } });
}

// このユーザーは DB に存在しないダミー。student_exhibitions.owner の beforeChange hook が
// 「executive でなければ渡した value を無視して previousValue/req.user?.id を使う」実装のため、
// Local API で owner を明示指定するには isExecutive(req.user) === true にする必要がある。
const FAKE_EXECUTIVE = { id: 'seed-script', role: 'executive', collection: 'users' };

// frontend/src/lib/campus-map-config.ts の CAMPUS_MAP_CONFIG.bounds (群馬大学荒牧キャンパス) 内に
// 収まるよう、キャンパス中心 [36.4318, 139.0464] 周辺に配置した 8 エリア。大きさ・縦横比・頂点数を
// ばらけさせ、色・表示順は 1 件ずつ未設定にして CMS 側のフォールバック表示を確認できるようにしている。
const MAP_AREAS = [
  {
    name: '正門前',
    color: 'primary',
    sort: 1,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0396, 36.4355],
          [139.041, 36.43555],
          [139.0411, 36.4361],
          [139.03975, 36.43605],
          [139.0396, 36.4355],
        ],
      ],
    },
  },
  {
    name: '本部棟前広場',
    color: 'secondary',
    sort: 2,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0447, 36.4355],
          [139.0481, 36.4355],
          [139.0481, 36.436],
          [139.0464, 36.4363],
          [139.0447, 36.436],
          [139.0447, 36.4355],
        ],
      ],
    },
  },
  {
    name: '図書館ゾーン',
    color: 'accent',
    sort: 3,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0513, 36.4354],
          [139.0527, 36.43535],
          [139.0535, 36.4358],
          [139.0532, 36.43625],
          [139.0518, 36.4363],
          [139.0511, 36.43585],
          [139.0513, 36.4354],
        ],
      ],
    },
  },
  {
    name: 'サークル棟エリア',
    color: 'accent-alt',
    sort: 4,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0388, 36.4308],
          [139.0405, 36.4307],
          [139.042, 36.4311],
          [139.0419, 36.4322],
          [139.0403, 36.4327],
          [139.0387, 36.432],
          [139.0388, 36.4308],
        ],
      ],
    },
  },
  {
    name: '中央イベント広場',
    color: 'info',
    sort: 5,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0448, 36.4305],
          [139.0462, 36.4304],
          [139.0472, 36.4309],
          [139.0475, 36.4318],
          [139.047, 36.4327],
          [139.0458, 36.433],
          [139.0447, 36.4326],
          [139.0442, 36.4316],
          [139.0448, 36.4305],
        ],
      ],
    },
  },
  {
    name: '屋台通り',
    color: 'success',
    sort: 6,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0506, 36.43155],
          [139.0542, 36.4315],
          [139.0543, 36.43205],
          [139.05055, 36.4321],
          [139.0506, 36.43155],
        ],
      ],
    },
  },
  {
    name: '駐輪場',
    color: 'warning',
    sort: 7,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0396, 36.4273],
          [139.0412, 36.42735],
          [139.0404, 36.4283],
          [139.0396, 36.4273],
        ],
      ],
    },
  },
  {
    // 既定色フォールバックと表示順末尾配置の確認用に、あえて色・表示順を未設定にする
    name: '第一グラウンド屋外イベントエリア',
    color: undefined,
    sort: undefined,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.043, 36.426],
          [139.0435, 36.4255],
          [139.047, 36.4253],
          [139.052, 36.4254],
          [139.0565, 36.4256],
          [139.056, 36.428],
          [139.051, 36.429],
          [139.046, 36.4288],
          [139.043, 36.426],
        ],
      ],
    },
  },
] as const;

const STAGES = [
  { name: 'メインステージ', areaIndex: 7, sort: 1 },
  { name: 'サブステージ', areaIndex: 4, sort: 2 },
] as const;

const TIME_SLOTS = [
  { label: '10:00-10:30', start: '10:00', end: '10:30', sort: 1 },
  { label: '11:00-11:30', start: '11:00', end: '11:30', sort: 2 },
  { label: '13:00-13:30', start: '13:00', end: '13:30', sort: 3 },
  { label: '14:00-14:30', start: '14:00', end: '14:30', sort: 4 },
] as const;

const SEED_DAY = '2026-10-24';
function toDate(hhmm: string): string {
  return `${SEED_DAY}T${hhmm}:00.000+09:00`;
}

const IMAGE_FILES = [
  { id: '079cb354-ad68-4384-9107-b08f719e7dd7', name: 'seed-photo-1.png', alt: 'シード用写真1' },
  { id: '6fc63f5a-1058-4441-a2e0-f4d3b91afb57', name: 'seed-photo-2.png', alt: 'シード用写真2' },
  { id: '7dcb31b7-1d26-459b-a4d2-dc387c66a314', name: 'seed-photo-3.png', alt: 'シード用写真3' },
] as const;

type Category = 'stage' | 'exhibit' | 'vendor' | 'other';
type LocationKind = 'area-label' | 'area-only' | 'stage-only' | 'none';

type ExhibitionSeed = {
  readonly name: string;
  readonly organizationName: string;
  readonly categories: readonly Category[];
  readonly stageName?: string;
  readonly locationKind: LocationKind;
  readonly hasImage: boolean;
  readonly linkCount: 0 | 1 | 2 | 3;
};

const PLATFORMS = ['x', 'instagram', 'facebook', 'youtube', 'tiktok', 'line', 'website'] as const;

// カテゴリ・場所設定・リンク数・写真有無を意図的にばらけさせた 32 件。
// 出演用企画名 (stage_name) は stage を含むものにのみ付与する。
const EXHIBITIONS: readonly ExhibitionSeed[] = [
  { name: 'ダンス部ライブステージ', organizationName: 'ダンス部', categories: ['stage'], stageName: 'ダンス部 LIVE STAGE', locationKind: 'stage-only', hasImage: true, linkCount: 1 },
  { name: '軽音楽部 Live Session', organizationName: '軽音楽部', categories: ['stage'], stageName: '軽音楽部セッション', locationKind: 'stage-only', hasImage: true, linkCount: 2 },
  { name: 'お笑い研究会コント', organizationName: 'お笑い研究会', categories: ['stage'], stageName: 'お笑い研究会ネタ見せ', locationKind: 'stage-only', hasImage: false, linkCount: 0 },
  { name: '吹奏楽部定期演奏', organizationName: '吹奏楽部', categories: ['stage'], stageName: '吹奏楽部演奏会', locationKind: 'stage-only', hasImage: true, linkCount: 1 },
  { name: 'アイドル研究会 LIVE!', organizationName: 'アイドル研究会', categories: ['stage'], stageName: 'アイドル研究会 LIVE!', locationKind: 'stage-only', hasImage: true, linkCount: 3 },
  { name: '演劇部ミニ公演', organizationName: '演劇部', categories: ['stage'], stageName: '演劇部ミニ公演', locationKind: 'none', hasImage: false, linkCount: 0 },
  { name: 'K-POPダンスサークル ステージ＆展示', organizationName: 'K-POPダンスサークル', categories: ['stage', 'exhibit'], stageName: 'K-POPダンスサークル', locationKind: 'area-label', hasImage: true, linkCount: 2 },
  { name: 'よさこいサークル演舞と写真展', organizationName: 'よさこいサークル', categories: ['stage', 'exhibit'], stageName: 'よさこいサークル演舞', locationKind: 'area-only', hasImage: true, linkCount: 1 },
  { name: '美術部作品展', organizationName: '美術部', categories: ['exhibit'], locationKind: 'area-label', hasImage: true, linkCount: 1 },
  { name: '写真部フォト展示', organizationName: '写真部', categories: ['exhibit'], locationKind: 'area-label', hasImage: true, linkCount: 0 },
  { name: '書道部書作品展', organizationName: '書道部', categories: ['exhibit'], locationKind: 'area-only', hasImage: false, linkCount: 1 },
  { name: 'ロボット研究会デモ展示', organizationName: 'ロボット研究会', categories: ['exhibit'], locationKind: 'area-only', hasImage: true, linkCount: 3 },
  { name: 'プログラミング研究会 Demo Day', organizationName: 'プログラミング研究会', categories: ['exhibit'], locationKind: 'area-label', hasImage: true, linkCount: 2 },
  { name: '茶道部お点前体験', organizationName: '茶道部', categories: ['exhibit'], locationKind: 'area-only', hasImage: false, linkCount: 0 },
  { name: '華道部生け花展', organizationName: '華道部', categories: ['exhibit'], locationKind: 'none', hasImage: true, linkCount: 1 },
  { name: '天文部星空写真展', organizationName: '天文部', categories: ['exhibit'], locationKind: 'area-label', hasImage: true, linkCount: 2 },
  { name: 'ＳＤＧｓ研究会パネル展', organizationName: 'ＳＤＧｓ研究会', categories: ['exhibit'], locationKind: 'area-only', hasImage: false, linkCount: 1 },
  { name: '鉄道研究会模型展示', organizationName: '鉄道研究会', categories: ['exhibit'], locationKind: 'none', hasImage: true, linkCount: 0 },
  { name: '焼きそば屋台', organizationName: '調理部', categories: ['vendor'], locationKind: 'area-label', hasImage: true, linkCount: 0 },
  { name: 'たこ焼き屋台', organizationName: 'たこ焼き愛好会', categories: ['vendor'], locationKind: 'area-label', hasImage: true, linkCount: 1 },
  { name: 'クレープ販売', organizationName: 'スイーツ研究会', categories: ['vendor'], locationKind: 'area-only', hasImage: false, linkCount: 2 },
  { name: 'からあげ販売', organizationName: 'からあげ同好会', categories: ['vendor'], locationKind: 'area-only', hasImage: true, linkCount: 1 },
  { name: 'Ｃａｆｅ ｄｅ 荒牧', organizationName: '喫茶同好会', categories: ['vendor'], locationKind: 'area-label', hasImage: true, linkCount: 3 },
  { name: '綿菓子屋台', organizationName: 'お祭り実行部隊', categories: ['vendor'], locationKind: 'none', hasImage: false, linkCount: 0 },
  { name: 'フランクフルト屋台', organizationName: '肉部', categories: ['vendor'], locationKind: 'area-only', hasImage: true, linkCount: 1 },
  { name: 'かき氷屋台', organizationName: 'かき氷愛好会', categories: ['vendor'], locationKind: 'none', hasImage: true, linkCount: 2 },
  { name: 'スタンプラリー企画', organizationName: '実行委員 企画局', categories: ['other'], locationKind: 'none', hasImage: false, linkCount: 0 },
  { name: 'フォトスポット設置', organizationName: '実行委員 装飾局', categories: ['other'], locationKind: 'none', hasImage: true, linkCount: 1 },
  { name: '献血キャンペーン', organizationName: '献血サークル', categories: ['other'], locationKind: 'none', hasImage: false, linkCount: 1 },
  { name: '占いの館', organizationName: '占い研究会', categories: ['other'], locationKind: 'none', hasImage: true, linkCount: 2 },
  { name: 'ボードゲーム体験会', organizationName: 'ボードゲーム部', categories: ['other'], locationKind: 'none', hasImage: false, linkCount: 0 },
  { name: 'VR体験コーナー', organizationName: 'VR研究会', categories: ['other'], locationKind: 'none', hasImage: true, linkCount: 1 },
];

function links(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => {
    const platform = PLATFORMS[(offset + i) % PLATFORMS.length]!;
    return { platform, url: `https://example.com/seed/${platform}/${offset}-${i}` };
  });
}

// stage カテゴリのみ stageName を企画名として優先する。それ以外のカテゴリは e.name を共有する
function categoryContent(e: ExhibitionSeed, category: Category, imageId: number | undefined) {
  const name = category === 'stage' ? (e.stageName ?? e.name) : e.name;
  return {
    name,
    description: `${name} の紹介文 (シードデータ)。`,
    images: imageId === undefined ? undefined : [imageId],
  };
}

async function main() {
  assertLocalDatabase();

  const payload = await getPayload({ config: configPromise });

  await resetPreviousSeed(payload);

  // 1. media (使い回し用に3枚アップロード)
  const mediaIds: number[] = [];
  for (const f of IMAGE_FILES) {
    const buffer = fs.readFileSync(path.join(seedFilesDir, f.id));
    const created = await payload.create({
      collection: 'media',
      data: { alt: f.alt },
      file: { data: buffer, mimetype: 'image/png', name: f.name, size: buffer.length },
      user: FAKE_EXECUTIVE,
    });
    mediaIds.push(created.id as number);
  }
  console.log(`media: ${mediaIds.length} 件作成`);

  // 2. map_areas
  const areaIds: number[] = [];
  for (const a of MAP_AREAS) {
    const created = await payload.create({
      collection: 'map_areas',
      data: { name: a.name, geometry: a.geometry, color: a.color, sort: a.sort },
      user: FAKE_EXECUTIVE,
    });
    areaIds.push(created.id as number);
  }
  console.log(`map_areas: ${areaIds.length} 件作成`);

  // 3. stages
  const stageIds: number[] = [];
  for (const s of STAGES) {
    const created = await payload.create({
      collection: 'stages',
      data: { name: s.name, area_id: areaIds[s.areaIndex]!, sort: s.sort },
      user: FAKE_EXECUTIVE,
    });
    stageIds.push(created.id as number);
  }
  console.log(`stages: ${stageIds.length} 件作成`);

  // 4. time_slots
  const timeSlotIds: number[] = [];
  for (const t of TIME_SLOTS) {
    const created = await payload.create({
      collection: 'time_slots',
      data: { label: t.label, start_at: toDate(t.start), end_at: toDate(t.end), sort: t.sort },
      user: FAKE_EXECUTIVE,
    });
    timeSlotIds.push(created.id as number);
  }
  console.log(`time_slots: ${timeSlotIds.length} 件作成`);

  // 5. student_exhibitions (+ owner 用ダミーユーザー, + stage-only のための performance_slots)
  const areaBoothCounters = areaIds.map(() => 0);
  let performanceSlotCount = 0;
  // (stage_id, time_slot_id) に UNIQUE 制約があるため、組み合わせが尽きないよう
  // 2 軸を独立させず通し番号から導出する
  let slotCombo = 0;

  for (const [i, e] of EXHIBITIONS.entries()) {
    const ownerUser = await payload.create({
      collection: 'users',
      data: {
        email: `${SEED_EMAIL_PREFIX}${String(i + 1).padStart(2, '0')}@example.invalid`,
        password: 'seed-dev-password-1234',
        role: 'student_exhibitor',
      },
      user: FAKE_EXECUTIVE,
    });

    const areaIndex = i % areaIds.length;
    const wantsArea = e.locationKind === 'area-label' || e.locationKind === 'area-only';
    const boothNumber = wantsArea ? ++areaBoothCounters[areaIndex]! : undefined;
    const imageId = e.hasImage ? mediaIds[i % mediaIds.length] : undefined;
    const categoryFields = Object.fromEntries(
      e.categories.map((c) => [c, categoryContent(e, c, imageId)]),
    );

    const created = await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: ownerUser.id,
        status: 'published',
        organization_name: e.organizationName,
        categories: [...e.categories],
        area_id: wantsArea ? areaIds[areaIndex] : undefined,
        booth_number: boothNumber,
        booth_label: e.locationKind === 'area-label' ? `${boothNumber}番ブース` : undefined,
        links: links(e.linkCount, i),
        ...categoryFields,
      },
      user: FAKE_EXECUTIVE,
    });

    if (e.locationKind === 'stage-only' && e.categories.includes('stage')) {
      const stageIdx = slotCombo % stageIds.length;
      const timeIdx = Math.floor(slotCombo / stageIds.length) % timeSlotIds.length;
      slotCombo += 1;
      await payload.create({
        collection: 'performance_slots',
        data: {
          stage_id: stageIds[stageIdx]!,
          time_slot_id: timeSlotIds[timeIdx]!,
          exhibition_id: created.id as number,
        },
        user: FAKE_EXECUTIVE,
      });
      performanceSlotCount += 1;
    }
  }
  console.log(`student_exhibitions: ${EXHIBITIONS.length} 件作成 (owner ユーザーも同数作成)`);
  console.log(`performance_slots: ${performanceSlotCount} 件作成`);

  const publishedCount = await payload.count({
    collection: 'student_exhibitions',
    where: { status: { equals: 'published' } },
  });
  console.log(`公開済み student_exhibitions 総数: ${publishedCount.totalDocs}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
