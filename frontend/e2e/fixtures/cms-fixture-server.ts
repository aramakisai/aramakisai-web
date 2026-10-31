import { createServer, type Server } from 'node:http';

export const CMS_FIXTURE_PORT = 18055;
const CMS_ORIGIN = `http://127.0.0.1:${CMS_FIXTURE_PORT}`;

export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
);

const baseSponsor = {
  type: ['local'],
  logo: null,
  url: null,
  description: null,
  business_category: null,
  local_image: null,
  local_business_hours: null,
  local_phone: null,
  tier: null,
  area_id: null,
  booth_number: null,
  booth_label: null,
  updatedAt: '2026-10-22T00:00:00.000Z',
  createdAt: '2026-10-22T00:00:00.000Z',
};

const regionalSponsors = [
  {
    ...baseSponsor,
    id: 101,
    _order: 'a01',
    name: 'テスト専用あらまき病院',
    business_category: 'hospital',
    local_latitude: 36.41,
    local_longitude: 139.1,
    address: '群馬県テスト市中央1-1',
    local_image: { id: 201, alt: 'テスト専用病院の外観' },
    description: '地域のみなさまを応援します。\nテスト専用メッセージです。',
    local_business_hours: '9:00〜17:00\n日曜定休',
    local_phone: '027-000-0000',
    url: 'https://example.invalid/hospital',
  },
  {
    ...baseSponsor,
    id: 102,
    _order: 'a02',
    name: 'テスト専用くらし商店',
    business_category: 'life',
    local_latitude: 36.43,
    local_longitude: 139.16,
    address: '群馬県テスト市くらし2-2',
  },
  {
    ...baseSponsor,
    id: 103,
    _order: 'a03',
    name: 'テスト専用自動車工房',
    business_category: 'car',
    local_latitude: 36.38,
    local_longitude: 139.16,
    address: '群馬県テスト市くるま3-3',
    local_image: { id: 202, alt: '読込失敗確認用画像' },
  },
  {
    ...baseSponsor,
    id: 104,
    _order: 'a04',
    name: 'テスト専用学習塾',
    business_category: 'education',
    local_latitude: 36.45,
    local_longitude: 139.08,
    address: '群馬県テスト市まなび4-4',
  },
  {
    ...baseSponsor,
    id: 105,
    _order: 'a05',
    name: 'テスト専用食堂A',
    business_category: 'food',
    local_latitude: 36.405,
    local_longitude: 139.125,
    address: '群馬県テスト市同一座標5-5',
  },
  {
    ...baseSponsor,
    id: 106,
    _order: 'a06',
    name: 'テスト専用食堂B',
    business_category: 'food',
    local_latitude: 36.405,
    local_longitude: 139.125,
    address: '群馬県テスト市同一座標5-5',
  },
  {
    ...baseSponsor,
    id: 107,
    _order: 'a07',
    name: 'テスト専用雑貨店',
    business_category: 'shop',
    local_latitude: 36.37,
    local_longitude: 139.075,
    address: '群馬県テスト市おみせ7-7',
  },
  {
    ...baseSponsor,
    id: 109,
    _order: 'a09',
    name: 'テスト専用雑貨店B',
    business_category: 'shop',
    local_latitude: 36.37003,
    local_longitude: 139.075,
    address: '群馬県テスト市おみせ7-7',
  },
  {
    ...baseSponsor,
    id: 108,
    _order: 'a08',
    name: '除外確認用不正fixture',
    business_category: 'shop',
    local_latitude: 999,
    local_longitude: 139.1,
    address: '公開されないテスト専用住所',
  },
];

// 異なる縦横比を画像領域に収められることを確認する合成ロゴ。
const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="navy"/></svg>',
);
const TALL_LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><rect width="100" height="400" fill="navy"/></svg>',
);

const adSponsors = [
  ...(['planA', 'planB', 'planC'] as const).flatMap((tier, groupIndex) =>
    Array.from({ length: groupIndex + 2 }, (_, index) => ({
      id: 100 + groupIndex * 10 + index,
      name: `架空${tier}-${index + 1}`,
      type: ['ad'],
      tier,
      logo: 100 + groupIndex * 10 + index,
      url: index === 0 ? 'https://example.invalid/sponsor' : null,
      _order: `0${index}`,
    })).reverse(),
  ),
  ...[
    { id: 201, name: '架空Dリンク', url: 'https://example.invalid/d' },
    {
      id: 202,
      name: '架空D企業名がとても長くても省略せず折り返して表示されます',
      url: null,
    },
    { id: 203, name: '架空D無効URL', url: 'javascript:alert(1)' },
  ]
    .map((item, index) => ({
      ...item,
      type: ['ad'],
      tier: 'planD',
      logo: null,
      _order: `0${index}`,
    }))
    .reverse(),
  {
    id: 301,
    name: '架空ロゴなしC',
    type: ['ad'],
    tier: 'planC',
    logo: null,
    url: 'https://example.invalid/noname',
    _order: '09',
  },
  {
    id: 300,
    name: '地域のみ企業',
    type: ['local'],
    tier: null,
    logo: null,
    url: null,
    _order: '00',
  },
];
const personal = [
  {
    id: 3,
    name: '架空の長い個人協賛者名が省略されず折り返して表示されます',
    _order: '03',
  },
  { id: 2, name: '架空二郎様', _order: '02' },
  { id: 1, name: '架空一郎', _order: '01' },
].map((item) => ({
  ...item,
  type: ['personal'],
  tier: null,
  logo: null,
  url: null,
}));

// 地域協賛の取得失敗確認用。テストワーカーとは別プロセスなので HTTP で切り替える。
// 影響範囲を type=local の取得に限り、並列実行中の広告協賛 spec を巻き込まない。
const MODE_PATH = '/__fixture/regional-mode';
let regionalMode: 'ok' | 'error' = 'ok';

export async function setRegionalCmsMode(mode: 'ok' | 'error'): Promise<void> {
  const response = await fetch(`${CMS_ORIGIN}${MODE_PATH}?value=${mode}`);
  if (!response.ok)
    throw new Error(`fixture mode switch failed: ${response.status}`);
}

const adLogoIds = new Set(
  adSponsors.flatMap((doc) => (doc.logo === null ? [] : [doc.logo])),
);

export function startCmsFixtureServer(): Promise<Server> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', CMS_ORIGIN);
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (url.pathname === MODE_PATH) {
      regionalMode = url.searchParams.get('value') === 'error' ? 'error' : 'ok';
      response.writeHead(200);
      response.end();
      return;
    }
    if (url.pathname === '/api/sponsors') {
      const type = url.searchParams.get('where[type][equals]');
      if (type === 'local') {
        if (regionalMode === 'error') {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'fixture unavailable' }));
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            docs: regionalSponsors,
            totalDocs: regionalSponsors.length,
          }),
        );
        return;
      }
      const docs = [...adSponsors, ...personal]
        .filter((doc) => !type || doc.type.includes(type))
        .sort((a, b) => a._order.localeCompare(b._order));
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ docs, totalDocs: docs.length }));
      return;
    }
    const media = url.pathname.match(/^\/api\/media\/serve\/(\d+)\//);
    if (media) {
      const id = Number(media[1]);
      if (id === 201) {
        response.writeHead(200, { 'Content-Type': 'image/png' });
        response.end(ONE_PIXEL_PNG);
        return;
      }
      if (adLogoIds.has(id)) {
        response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        response.end(id === 110 ? TALL_LOGO : LOGO);
        return;
      }
    }
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'fixture not found' }));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(CMS_FIXTURE_PORT, '127.0.0.1', () => resolve(server));
  });
}
