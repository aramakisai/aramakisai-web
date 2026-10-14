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
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload, type Payload } from 'payload'

import configPromise from '../src/payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const seedFilesDir = path.resolve(dirname, '../seed/files')

// 本番 DB を誤爆しないための必須ガード。infisical --env=prod 経由の実行は接続先が
// localhost:5433 にならないため、ここで弾かれる。
function assertLocalDatabase(): void {
  const raw = process.env.DATABASE_URL ?? ''
  const url = new URL(raw)
  if (url.hostname !== 'localhost' || url.port !== '5433') {
    throw new Error(
      `DATABASE_URL の接続先が localhost:5433 ではない (${url.hostname}:${url.port})。` +
        '本番/staging への誤投入を避けるため中断する。',
    )
  }
}

const SEED_EMAIL_PREFIX = 'seed-exhibitor-'

// 2 回目以降の実行でも新しいマップエリア座標を反映できるよう、前回シードした分を全削除してから
// 入れ直す。参照先を先に消す必要がある (performance_slots → student_exhibitions/stages →
// map_areas/media/users の順)。ローカル専用データのみを対象にするため assertLocalDatabase() の
// 後でのみ呼び出すこと。
async function resetPreviousSeed(payload: Payload): Promise<void> {
  const already = await payload.find({
    collection: 'users',
    where: { email: { like: SEED_EMAIL_PREFIX } },
    limit: 1,
  })
  if (already.docs.length === 0) return

  console.log('既存のシードデータを検出したため、削除してから再投入する。')
  const all = { id: { exists: true } }
  await payload.delete({ collection: 'performance_slots', where: all })
  await payload.delete({ collection: 'student_exhibitions', where: all })
  await payload.delete({ collection: 'stages', where: all })
  await payload.delete({ collection: 'map_areas', where: all })
  // media は他のシードスクリプトとも共有されるコレクションのため、全削除すると
  // seed-dev-content.ts がアップロードした media を巻き込んで消してしまう。
  // alt プレフィックスでこのスクリプト自身が作った分だけに絞る。
  await payload.delete({ collection: 'media', where: { alt: { like: 'シード用写真' } } })
  await payload.delete({ collection: 'users', where: { email: { like: SEED_EMAIL_PREFIX } } })
}

// student_exhibitions.owner の beforeChange hook が「executive でなければ渡した value を無視して
// previousValue/req.user?.id を使う」実装のため、Local API で owner を明示指定するには
// isExecutive(req.user) === true にする必要がある。また media.owner (アップロード者) は
// relationship 型で実在 ID を要求するため、DB に存在しないダミー ID は使えない。main() 内で
// 実行委員アカウントを実際に作成してから代入する。
let FAKE_EXECUTIVE: { id: number; role: 'executive'; collection: 'users' }

// 本番 CMS (map_areas) の内容を id 昇順でそのまま写したもの。stages / 出展者の areaIndex はこの並び順に依存する
const MAP_AREAS: {
  name: string
  color?: string
  hasAed?: boolean
  hasToilet?: boolean
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }
}[] = [
  {
    name: 'Cグループ',
    color: '#e86f30',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.0448929, 36.4307667],
            [139.0448684, 36.4307823],
            [139.0449331, 36.430841],
            [139.0450101, 36.4308927],
            [139.045028, 36.4308733],
            [139.044968, 36.4308322],
            [139.0448929, 36.4307667],
          ],
        ],
        [
          [
            [139.0451349, 36.4309351],
            [139.0451875, 36.4309591],
            [139.0452346, 36.430976],
            [139.0452883, 36.4309897],
            [139.0453959, 36.4310059],
            [139.0453959, 36.4310307],
            [139.0453337, 36.4310274],
            [139.0452771, 36.4310168],
            [139.0452215, 36.4310035],
            [139.045171, 36.4309842],
            [139.0451157, 36.4309566],
            [139.0451349, 36.4309351],
          ],
        ],
        [
          [
            [139.04449686394958, 36.430683915714496],
            [139.0447756132267, 36.43079028653713],
            [139.0447923207558, 36.43076194413244],
            [139.0445135714786, 36.430655573270926],
            [139.04449686394958, 36.430683915714496],
          ],
        ],
      ],
    },
  },
  {
    name: '本部',
    color: '#e4ab53',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04507519245698, 36.43086827352877],
            [139.0451683590905, 36.43090548371305],
            [139.0451983904676, 36.43085680875467],
            [139.04510522383407, 36.430819598546606],
            [139.04507519245698, 36.43086827352877],
          ],
        ],
      ],
    },
  },
  {
    name: 'Aグループ',
    color: '#8cb76b',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04631066846827, 36.43132217122789],
            [139.0457482, 36.4311124],
            [139.0457322, 36.4311054],
            [139.0457219, 36.4310984],
            [139.0457185, 36.4310937],
            [139.0457165, 36.4310883],
            [139.0457168, 36.4310752],
            [139.0457183, 36.4310562],
            [139.0456818, 36.4310515],
            [139.0456783, 36.4310693],
            [139.0456781, 36.4310898],
            [139.0456839, 36.431104],
            [139.0456884, 36.4311115],
            [139.0456962, 36.4311202],
            [139.04571091993415, 36.43112794059314],
            [139.0462970698435, 36.431345849795235],
            [139.04631066846827, 36.43132217122789],
          ],
        ],
        [
          [
            [139.0460466, 36.4315274],
            [139.0460443, 36.4314992],
            [139.0460377, 36.4314736],
            [139.046021, 36.4314393],
            [139.0459973, 36.4314146],
            [139.0459572, 36.4313814],
            [139.0459188, 36.4313586],
            [139.0459436, 36.4313312],
            [139.0459744, 36.4313488],
            [139.0459889, 36.4313579],
            [139.0460118, 36.4313761],
            [139.0460259, 36.4313887],
            [139.0460452, 36.4314105],
            [139.0460632, 36.4314318],
            [139.0460739, 36.4314533],
            [139.0460821, 36.4314778],
            [139.0460866, 36.4314978],
            [139.046085, 36.431518],
            [139.0460842, 36.4315299],
            [139.0460466, 36.4315274],
          ],
        ],
      ],
    },
  },
  {
    name: '野外ステージ',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04503081714665, 36.43113234976775],
            [139.04517326584488, 36.43118530706184],
            [139.04520787837026, 36.43112503796233],
            [139.0450654296721, 36.431072080627146],
            [139.04503081714665, 36.43113234976775],
          ],
        ],
      ],
    },
  },
  {
    name: 'Eグループ',
    color: '#80c1c6',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04503081714665, 36.43113234976775],
            [139.04517326584488, 36.43118530706184],
            [139.04520787837026, 36.43112503796233],
            [139.0450654296721, 36.431072080627146],
            [139.04503081714665, 36.43113234976775],
          ],
        ],
      ],
    },
  },
  {
    name: 'Dグループ',
    color: '#7fc8ad',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.0443053229855, 36.43097444644093],
            [139.04434381798177, 36.430988757526606],
            [139.04449056225855, 36.43073323791289],
            [139.04445206726223, 36.43071892678009],
            [139.0443053229855, 36.43097444644093],
          ],
        ],
      ],
    },
  },
  {
    name: 'Bグループ',
    color: '#ebb03c',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.045543, 36.4307083],
            [139.045575, 36.4307011],
            [139.0455622, 36.4306603],
            [139.0455514, 36.4306368],
            [139.0455384, 36.4306058],
            [139.0455207, 36.4305744],
            [139.0454978, 36.4305437],
            [139.0454606, 36.4305181],
            [139.045431, 36.4305045],
            [139.0454133, 36.4305241],
            [139.0454422, 36.4305387],
            [139.0454694, 36.4305593],
            [139.0454929, 36.4305889],
            [139.0455064, 36.4306117],
            [139.0455215, 36.4306433],
            [139.0455302, 36.4306666],
            [139.0455391, 36.4306922],
            [139.045543, 36.4307083],
          ],
        ],
        [
          [
            [139.0452127004703, 36.43037846767061],
            [139.0454358793105, 36.43046760446873],
            [139.0454504565389, 36.43044397751602],
            [139.0452272777, 36.43035484069078],
            [139.0452127004703, 36.43037846767061],
          ],
        ],
        [
          [
            [139.045464, 36.4309618],
            [139.0454962, 36.4309452],
            [139.0455255, 36.4309216],
            [139.0455488, 36.4308926],
            [139.0455699, 36.4308525],
            [139.0455823, 36.4308206],
            [139.0456079, 36.4308281],
            [139.0455985, 36.4308607],
            [139.0455738, 36.4309012],
            [139.0455474, 36.4309354],
            [139.045512, 36.4309637],
            [139.0454806, 36.4309796],
            [139.045464, 36.4309618],
          ],
        ],
        [
          [
            [139.0456062389228, 36.43073372390498],
            [139.0456208427937, 36.43078716556765],
            [139.04564851871817, 36.43078226977313],
            [139.04563391484731, 36.430728828106425],
            [139.0456062389228, 36.43073372390498],
          ],
        ],
      ],
    },
  },
  {
    name: 'キッチンカー',
    color: '#a8a29e',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04422359016684, 36.43112307190408],
            [139.04425440883796, 36.43113456164251],
            [139.0443221309978, 36.43101469048419],
            [139.04429131232723, 36.43100320072897],
            [139.04422359016684, 36.43112307190408],
          ],
        ],
        [
          [
            [139.04419493015382, 36.43111265638073],
            [139.04416721304506, 36.43110182490966],
            [139.04423339524135, 36.43098885372106],
            [139.044261112348, 36.43099968520646],
            [139.04419493015382, 36.43111265638073],
          ],
        ],
      ],
    },
  },
  {
    name: '弓道場',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04289899527447, 36.429740116287505],
            [139.04310612301663, 36.42981154339863],
            [139.04327412743652, 36.429496158594915],
            [139.04306699969652, 36.429424731194445],
            [139.04289899527447, 36.429740116287505],
          ],
        ],
      ],
    },
  },
  {
    name: '馬術場',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04354351951173, 36.432991841225785],
            [139.04401206472954, 36.433447517102564],
            [139.04436457959014, 36.433212890132125],
            [139.04389603437227, 36.43275721287799],
            [139.04354351951173, 36.432991841225785],
          ],
        ],
      ],
    },
  },
  {
    name: '屋内ステージ',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04375837456763, 36.429853364532434],
            [139.04409230879497, 36.4299729877268],
            [139.0441914268581, 36.429793868929266],
            [139.04385749263275, 36.429674245458855],
            [139.04375837456763, 36.429853364532434],
          ],
        ],
      ],
    },
  },
  {
    name: '武道館ステージ',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04386987570285, 36.429400602930116],
            [139.04431337622873, 36.42956548400832],
            [139.04439885964968, 36.42941663270709],
            [139.04395535912636, 36.42925175131275],
            [139.04386987570285, 36.429400602930116],
          ],
        ],
      ],
    },
  },
  {
    name: '6号館',
    color: '#aeb49c',
    hasAed: true,
    hasToilet: true,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.043081, 36.430528],
            [139.043119, 36.430472],
            [139.043065, 36.430446],
            [139.043092, 36.430399],
            [139.043146, 36.430416],
            [139.043178, 36.430355],
            [139.043377, 36.430425],
            [139.043366, 36.430446],
            [139.043704, 36.43058],
            [139.043832, 36.43036],
            [139.043983, 36.430412],
            [139.04395, 36.430459],
            [139.043999, 36.430481],
            [139.043902, 36.430649],
            [139.043993, 36.430688],
            [139.043945, 36.430774],
            [139.043849, 36.43074],
            [139.043811, 36.430817],
            [139.0438, 36.430813],
            [139.043768, 36.430873],
            [139.043629, 36.430822],
            [139.043634, 36.430809],
            [139.043596, 36.430796],
            [139.04365, 36.430701],
            [139.043296, 36.43058],
            [139.04328, 36.430597],
            [139.043081, 36.430528],
          ],
        ],
      ],
    },
  },
  {
    name: '5号館',
    color: '#c9bf86',
    hasToilet: true,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.042985, 36.429984],
            [139.04306, 36.429915],
            [139.043264, 36.430049],
            [139.043221, 36.430088],
            [139.043253, 36.430109],
            [139.043328, 36.430049],
            [139.043419, 36.430109],
            [139.043398, 36.43014],
            [139.043763, 36.430273],
            [139.043741, 36.430312],
            [139.043838, 36.430351],
            [139.043806, 36.430412],
            [139.043714, 36.430377],
            [139.043704, 36.43039],
            [139.043339, 36.430256],
            [139.043269, 36.430209],
            [139.043237, 36.430239],
            [139.04314, 36.430174],
            [139.043178, 36.430135],
            [139.04314, 36.430109],
            [139.043151, 36.430101],
            [139.042985, 36.429984],
          ],
        ],
      ],
    },
  },
  {
    name: '2号館',
    color: '#a18abf',
    hasAed: true,
    hasToilet: true,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.04468, 36.430278],
            [139.044809, 36.430062],
            [139.045034, 36.430196],
            [139.045061, 36.430144],
            [139.045179, 36.430187],
            [139.045179, 36.4302],
            [139.045522, 36.430334],
            [139.04549, 36.430381],
            [139.045533, 36.430399],
            [139.045517, 36.430425],
            [139.045479, 36.430407],
            [139.045458, 36.430442],
            [139.045109, 36.430304],
            [139.045045, 36.430407],
            [139.045023, 36.430399],
            [139.045002, 36.430429],
            [139.044943, 36.430407],
            [139.044959, 36.430381],
            [139.044921, 36.430368],
            [139.044938, 36.430338],
            [139.04468, 36.430278],
          ],
        ],
      ],
    },
  },
  {
    name: '3号館',
    color: '#ee7e84',
    hasAed: true,
    hasToilet: true,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [139.045324, 36.430053],
            [139.045426, 36.429894],
            [139.045764, 36.430027],
            [139.045737, 36.430071],
            [139.04578, 36.430084],
            [139.045742, 36.430148],
            [139.045646, 36.430109],
            [139.045624, 36.430127],
            [139.045485, 36.430075],
            [139.045495, 36.430058],
            [139.045426, 36.430027],
            [139.045394, 36.430079],
            [139.045324, 36.430053],
          ],
        ],
        [
          [
            [139.045211, 36.429941],
            [139.04527, 36.429838],
            [139.045372, 36.429876],
            [139.045313, 36.42998],
            [139.045211, 36.429941],
          ],
        ],
      ],
    },
  },
]

const STAGES = [
  { name: 'メインステージ', areaIndex: 10, sort: 1 },
  { name: 'サブステージ', areaIndex: 3, sort: 2 },
] as const

const PERFORMANCE_TIMES = [
  { start: '10:00', end: '10:30' },
  { start: '11:00', end: '11:30' },
  { start: '13:00', end: '13:30' },
  { start: '14:00', end: '14:30' },
] as const

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// 開催日程が無いと出演枠の開催日を決められないため、何も作る前に中断する。
async function readEventDayKeys(payload: Payload): Promise<string[]> {
  const meta = await payload.findGlobal({ slug: 'site_settings' })
  const keys = [
    ...new Set(
      (meta.event_days ?? []).map((d) =>
        new Date(Date.parse(d.start_at) + JST_OFFSET_MS).toISOString().slice(0, 10),
      ),
    ),
  ].sort()
  if (keys.length === 0) {
    throw new Error('サイト設定の開催日程が空。管理画面で登録してから再実行する。')
  }
  return keys
}

const IMAGE_FILES = [
  { id: '079cb354-ad68-4384-9107-b08f719e7dd7', name: 'seed-photo-1.png', alt: 'シード用写真1' },
  { id: '6fc63f5a-1058-4441-a2e0-f4d3b91afb57', name: 'seed-photo-2.png', alt: 'シード用写真2' },
  { id: '7dcb31b7-1d26-459b-a4d2-dc387c66a314', name: 'seed-photo-3.png', alt: 'シード用写真3' },
] as const

const KARAAGE_IMAGE_FILE = 'seed-photo-karaage.webp'

type Category = 'stage' | 'exhibit' | 'vendor' | 'other'
type LocationKind = 'area-label' | 'area-only' | 'stage-only' | 'none'

type ExhibitionSeed = {
  readonly name: string
  readonly organizationName: string
  readonly categories: readonly Category[]
  readonly stageName?: string
  readonly locationKind: LocationKind
  readonly hasImage: boolean
  readonly linkCount: 0 | 1 | 2 | 3
}

const PLATFORMS = ['x', 'instagram', 'facebook', 'youtube', 'tiktok', 'line', 'website'] as const

// カテゴリ・場所設定・リンク数・写真有無を意図的にばらけさせた 32 件。
// 出演用企画名 (stage_name) は stage を含むものにのみ付与する。
const EXHIBITIONS: readonly ExhibitionSeed[] = [
  {
    name: 'ダンス部ライブステージ',
    organizationName: 'ダンス部',
    categories: ['stage'],
    stageName: 'ダンス部 LIVE STAGE',
    locationKind: 'stage-only',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: '軽音楽部 Live Session',
    organizationName: '軽音楽部',
    categories: ['stage'],
    stageName: '軽音楽部セッション',
    locationKind: 'stage-only',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: 'お笑い研究会コント',
    organizationName: 'お笑い研究会',
    categories: ['stage'],
    stageName: 'お笑い研究会ネタ見せ',
    locationKind: 'stage-only',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: '吹奏楽部定期演奏',
    organizationName: '吹奏楽部',
    categories: ['stage'],
    stageName: '吹奏楽部演奏会',
    locationKind: 'stage-only',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: 'アイドル研究会 LIVE!',
    organizationName: 'アイドル研究会',
    categories: ['stage'],
    stageName: 'アイドル研究会 LIVE!',
    locationKind: 'stage-only',
    hasImage: true,
    linkCount: 3,
  },
  {
    name: '演劇部ミニ公演',
    organizationName: '演劇部',
    categories: ['stage'],
    stageName: '演劇部ミニ公演',
    locationKind: 'none',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: 'K-POPダンスサークル ステージ＆展示',
    organizationName: 'K-POPダンスサークル',
    categories: ['stage', 'exhibit'],
    stageName: 'K-POPダンスサークル',
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: 'よさこいサークル演舞と写真展',
    organizationName: 'よさこいサークル',
    categories: ['stage', 'exhibit'],
    stageName: 'よさこいサークル演舞',
    locationKind: 'area-only',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: '美術部作品展',
    organizationName: '美術部',
    categories: ['exhibit'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: '写真部フォト展示',
    organizationName: '写真部',
    categories: ['exhibit'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 0,
  },
  {
    name: '書道部書作品展',
    organizationName: '書道部',
    categories: ['exhibit'],
    locationKind: 'area-only',
    hasImage: false,
    linkCount: 1,
  },
  {
    name: 'ロボット研究会デモ展示',
    organizationName: 'ロボット研究会',
    categories: ['exhibit'],
    locationKind: 'area-only',
    hasImage: true,
    linkCount: 3,
  },
  {
    name: 'プログラミング研究会 Demo Day',
    organizationName: 'プログラミング研究会',
    categories: ['exhibit'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: '茶道部お点前体験',
    organizationName: '茶道部',
    categories: ['exhibit'],
    locationKind: 'area-only',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: '華道部生け花展',
    organizationName: '華道部',
    categories: ['exhibit'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: '天文部星空写真展',
    organizationName: '天文部',
    categories: ['exhibit'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: 'ＳＤＧｓ研究会パネル展',
    organizationName: 'ＳＤＧｓ研究会',
    categories: ['exhibit'],
    locationKind: 'area-only',
    hasImage: false,
    linkCount: 1,
  },
  {
    name: '鉄道研究会模型展示',
    organizationName: '鉄道研究会',
    categories: ['exhibit'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 0,
  },
  {
    name: '焼きそば屋台',
    organizationName: '調理部',
    categories: ['vendor'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 0,
  },
  {
    name: 'たこ焼き屋台',
    organizationName: 'たこ焼き愛好会',
    categories: ['vendor'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: 'クレープ販売',
    organizationName: 'スイーツ研究会',
    categories: ['vendor'],
    locationKind: 'area-only',
    hasImage: false,
    linkCount: 2,
  },
  {
    name: 'からあげ販売',
    organizationName: 'からあげ同好会',
    categories: ['vendor'],
    locationKind: 'area-only',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: 'Ｃａｆｅ ｄｅ 荒牧',
    organizationName: '喫茶同好会',
    categories: ['vendor'],
    locationKind: 'area-label',
    hasImage: true,
    linkCount: 3,
  },
  {
    name: '綿菓子屋台',
    organizationName: 'お祭り実行部隊',
    categories: ['vendor'],
    locationKind: 'none',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: 'フランクフルト屋台',
    organizationName: '肉部',
    categories: ['vendor'],
    locationKind: 'area-only',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: 'かき氷屋台',
    organizationName: 'かき氷愛好会',
    categories: ['vendor'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: 'スタンプラリー企画',
    organizationName: '実行委員 企画局',
    categories: ['other'],
    locationKind: 'none',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: 'フォトスポット設置',
    organizationName: '実行委員 装飾局',
    categories: ['other'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 1,
  },
  {
    name: '献血キャンペーン',
    organizationName: '献血サークル',
    categories: ['other'],
    locationKind: 'none',
    hasImage: false,
    linkCount: 1,
  },
  {
    name: '占いの館',
    organizationName: '占い研究会',
    categories: ['other'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 2,
  },
  {
    name: 'ボードゲーム体験会',
    organizationName: 'ボードゲーム部',
    categories: ['other'],
    locationKind: 'none',
    hasImage: false,
    linkCount: 0,
  },
  {
    name: 'VR体験コーナー',
    organizationName: 'VR研究会',
    categories: ['other'],
    locationKind: 'none',
    hasImage: true,
    linkCount: 1,
  },
]

function links(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => {
    const platform = PLATFORMS[(offset + i) % PLATFORMS.length]!
    return { platform, url: `https://example.com/seed/${platform}/${offset}-${i}` }
  })
}

// stage カテゴリのみ stageName を企画名として優先する。それ以外のカテゴリは e.name を共有する
function categoryContent(e: ExhibitionSeed, category: Category, imageId: number | undefined) {
  const name = category === 'stage' ? (e.stageName ?? e.name) : e.name
  return {
    name,
    description: `${name} の紹介文 (シードデータ)。`,
    images: imageId === undefined ? undefined : [imageId],
  }
}

// 本番 CMS 相当の出店エントリ (画像・メニュー・リンク・ブース番号が揃った実データ形)。
// エリアは MAP_AREAS の並びが変わっても追従できるよう名前で引く。
async function createKaraageExhibition(payload: Payload): Promise<void> {
  const area = await payload.find({
    collection: 'map_areas',
    where: { name: { equals: 'Bグループ' } },
    limit: 1,
  })
  const areaId = area.docs[0]?.id
  if (areaId === undefined) throw new Error('map_areas に「Bグループ」が無い')

  const buffer = fs.readFileSync(path.join(seedFilesDir, KARAAGE_IMAGE_FILE))
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'シード用写真からあげ' },
    file: { data: buffer, mimetype: 'image/webp', name: KARAAGE_IMAGE_FILE, size: buffer.length },
    user: FAKE_EXECUTIVE,
  })

  const owner = await payload.create({
    collection: 'users',
    data: {
      email: `${SEED_EMAIL_PREFIX}karaage@example.invalid`,
      password: 'seed-dev-password-1234',
      role: 'student_exhibitor',
    },
    user: FAKE_EXECUTIVE,
  })

  await payload.create({
    collection: 'student_exhibitions',
    data: {
      owner: owner.id,
      status: 'published',
      organization_name: '荒牧祭実行委員会企画部',
      categories: ['vendor'],
      links: [
        { platform: 'instagram', url: 'https://www.instagram.com/aramakisai_' },
        { platform: 'x', url: 'https://x.com/aramakisai_' },
        { platform: 'youtube', url: 'https://www.youtube.com/@aramakisai' },
        { platform: 'website', url: 'https://aramakisai.com/' },
      ],
      vendor: {
        name: '荒牧祭実行委員会のからあげ',
        description:
          '外はカリッと香ばしく、中はジューシー。 一口食べれば、思わず笑顔になるおいしさです。 毎年多くの方にご好評をいただいている名物メニュー。 学園祭ならではの熱気と一緒に、できたてをお楽しみください！',
        images: [media.id],
        open_days: ['2026-11-11T12:00:00.000Z', '2026-11-12T12:00:00.000Z'],
        area_id: areaId,
        booth_number: '8',
        menu: [
          { name: '唐揚げ中', price: 400 },
          { name: '唐揚げ大', price: 600 },
        ],
      },
    },
    user: FAKE_EXECUTIVE,
  })
  console.log('student_exhibitions: からあげ出店 1 件追加')
}

async function main() {
  assertLocalDatabase()

  const payload = await getPayload({ config: configPromise })
  const eventDayKeys = await readEventDayKeys(payload)

  await resetPreviousSeed(payload)

  const executiveUser = await payload.create({
    collection: 'users',
    data: {
      email: `${SEED_EMAIL_PREFIX}executive@example.invalid`,
      password: 'seed-dev-password-1234',
      role: 'executive',
    },
  })
  FAKE_EXECUTIVE = { id: executiveUser.id as number, role: 'executive', collection: 'users' }

  // 1. media (使い回し用に3枚アップロード)
  const mediaIds: number[] = []
  for (const f of IMAGE_FILES) {
    const buffer = fs.readFileSync(path.join(seedFilesDir, f.id))
    const created = await payload.create({
      collection: 'media',
      data: { alt: f.alt },
      file: { data: buffer, mimetype: 'image/png', name: f.name, size: buffer.length },
      user: FAKE_EXECUTIVE,
    })
    mediaIds.push(created.id as number)
  }
  console.log(`media: ${mediaIds.length} 件作成`)

  // 2. map_areas
  const areaIds: number[] = []
  for (const a of MAP_AREAS) {
    const created = await payload.create({
      collection: 'map_areas',
      data: {
        name: a.name,
        geometry: a.geometry,
        color: a.color,
        hasAed: a.hasAed,
        hasToilet: a.hasToilet,
      },
      user: FAKE_EXECUTIVE,
    })
    areaIds.push(created.id as number)
  }
  console.log(`map_areas: ${areaIds.length} 件作成`)

  // 3. stages
  const stageIds: number[] = []
  for (const s of STAGES) {
    const created = await payload.create({
      collection: 'stages',
      data: { name: s.name, area_id: areaIds[s.areaIndex]!, sort: s.sort },
      user: FAKE_EXECUTIVE,
    })
    stageIds.push(created.id as number)
  }
  console.log(`stages: ${stageIds.length} 件作成`)

  // 4. student_exhibitions (+ owner 用ダミーユーザー, + stage-only のための performance_slots)
  const areaBoothCounters = areaIds.map(() => 0)
  let performanceSlotCount = 0
  // 同ステージ・同開催日で時間帯が重ならないよう、通し番号からステージ→開催日→時間帯の順に導出する
  let slotCombo = 0

  for (const [i, e] of EXHIBITIONS.entries()) {
    const ownerUser = await payload.create({
      collection: 'users',
      data: {
        email: `${SEED_EMAIL_PREFIX}${String(i + 1).padStart(2, '0')}@example.invalid`,
        password: 'seed-dev-password-1234',
        role: 'student_exhibitor',
      },
      user: FAKE_EXECUTIVE,
    })

    const areaIndex = i % areaIds.length
    const wantsArea = e.locationKind === 'area-label' || e.locationKind === 'area-only'
    const boothNumber = wantsArea ? ++areaBoothCounters[areaIndex]! : undefined
    const imageId = e.hasImage ? mediaIds[i % mediaIds.length] : undefined
    // 配置はカテゴリのグループごとに持つ。ブース番号はエリア内で一意なので最初の非ステージに付ける
    const placementCategory = e.categories.find((c) => c !== 'stage')
    const categoryFields = Object.fromEntries(
      e.categories.map((c) => [
        c,
        {
          ...categoryContent(e, c, imageId),
          ...(c === 'stage'
            ? {}
            : {
                open_days: ['2026-11-01T12:00:00.000Z'],
                ...(c === placementCategory && wantsArea
                  ? {
                      area_id: areaIds[areaIndex],
                      booth_number: String(boothNumber),
                      booth_label:
                        e.locationKind === 'area-label' ? `${boothNumber}番ブース` : undefined,
                    }
                  : {}),
              }),
        },
      ]),
    )

    const created = await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: ownerUser.id,
        // 画像なしのエントリは validateCategoryContents (公開時は name/description/images 必須) に
        // 抵触するため draft にする。
        status: e.hasImage ? 'published' : 'draft',
        organization_name: e.organizationName,
        categories: [...e.categories],
        links: links(e.linkCount, i),
        ...categoryFields,
      },
      user: FAKE_EXECUTIVE,
    })

    if (e.locationKind === 'stage-only' && e.categories.includes('stage')) {
      const stageIdx = slotCombo % stageIds.length
      const dayIdx = Math.floor(slotCombo / stageIds.length) % eventDayKeys.length
      const timeIdx =
        Math.floor(slotCombo / (stageIds.length * eventDayKeys.length)) % PERFORMANCE_TIMES.length
      slotCombo += 1
      const dayKey = eventDayKeys[dayIdx]!
      const time = PERFORMANCE_TIMES[timeIdx]!
      await payload.create({
        collection: 'performance_slots',
        data: {
          stage_id: stageIds[stageIdx]!,
          event_date: `${dayKey}T12:00:00.000Z`,
          start_at: `${dayKey}T${time.start}:00.000+09:00`,
          end_at: `${dayKey}T${time.end}:00.000+09:00`,
          exhibition_id: created.id as number,
        },
        user: FAKE_EXECUTIVE,
      })
      performanceSlotCount += 1
    }
  }
  console.log(`student_exhibitions: ${EXHIBITIONS.length} 件作成 (owner ユーザーも同数作成)`)

  await createKaraageExhibition(payload)
  console.log(`performance_slots: ${performanceSlotCount} 件作成`)

  const publishedCount = await payload.count({
    collection: 'student_exhibitions',
    where: { status: { equals: 'published' } },
  })
  console.log(`公開済み student_exhibitions 総数: ${publishedCount.totalDocs}`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
