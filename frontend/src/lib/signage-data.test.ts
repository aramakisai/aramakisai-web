import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, findGlobal, getSponsors, getParkingResponse } = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    findGlobal: vi.fn(),
    getSponsors: vi.fn(),
    getParkingResponse: vi.fn(),
  }),
);

vi.mock('./cms', () => ({ cms: { findMany, findGlobal } }));
vi.mock('./sponsors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sponsors')>()),
  getSponsors,
}));
vi.mock('./parking-data', () => ({ getParkingResponse }));

import { getSignageSnapshot, SIGNAGE_TTL_SECONDS } from './signage-data';

const docs = (list: unknown[]) => ({
  ok: true,
  value: { docs: list, totalDocs: list.length },
});
const fail = { ok: false, error: { kind: 'network', status: 500 } };
const base = { updatedAt: '', createdAt: '' };

function setup(overrides: Record<string, unknown> = {}) {
  const byCollection: Record<string, unknown> = {
    signage_slides: docs([]),
    telops: docs([]),
    lost_items: docs([]),
    stages: docs([]),
    performance_slots: docs([]),
    ...overrides,
  };
  findMany.mockImplementation(async (c: string) => byCollection[c]);
  findGlobal.mockResolvedValue({
    ok: true,
    value: {
      event_days: [
        {
          start_at: '2026-11-14T10:00:00+09:00',
          end_at: '2026-11-14T17:00:00+09:00',
        },
      ],
    },
  });
  getSponsors.mockResolvedValue({
    ok: true,
    value: {
      ad: [{ id: 1, name: 'A社', logoId: '5', url: null, tier: 'planA' }],
      local: [{ id: 1, name: 'A社', logoId: '5', url: null, tier: 'planA' }],
      vendor: [],
      other: [{ id: 2, name: 'B社', logoId: null, url: null, tier: null }],
    },
  });
  getParkingResponse.mockResolvedValue({
    ok: true,
    value: { isEventDay: false, lots: [], fetchedAt: 'x' },
  });
}

const slide = (id: number, extra = {}) => ({
  id,
  kind: 'layout',
  title: `s${id}`,
  layout: 'title-content',
  tone: 'alert',
  subtext: null,
  content1_html: '<p>a</p>',
  content2_html: null,
  duration_seconds: 12,
  pinned: false,
  ...base,
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe('getSignageSnapshot', () => {
  it('スライドとテロップは取得した並び順のまま返し、_order 昇順で取得する', async () => {
    setup({
      signage_slides: docs([slide(4), slide(1), slide(2), slide(3)]),
      telops: docs([
        { id: 9, audience: 'visitor', body: 'x', ...base },
        {
          id: 8,
          audience: 'group',
          target: '出店団体へ',
          body: 'y',
          ...base,
        },
        { id: 7, audience: 'visitor', body: 'z', ...base },
      ]),
    });
    const r = await getSignageSnapshot();
    if (!r.ok) throw new Error('failed');
    for (const c of ['signage_slides', 'telops']) {
      expect(findMany).toHaveBeenCalledWith(
        c,
        expect.objectContaining({ sort: ['_order'] }),
        expect.anything(),
      );
    }
    expect(r.value.slides.map((s) => s.id)).toEqual([4, 1, 2, 3]);
    expect(r.value.telops.map((t) => t.id)).toEqual([9, 8, 7]);
    expect(r.value.telops[1]).toMatchObject({
      audience: 'group',
      target: '出店団体へ',
    });
  });

  it('レイアウトスライドを表示用の型へ正規化する', async () => {
    setup({ signage_slides: docs([slide(1, { pinned: true })]) });
    const r = await getSignageSnapshot();
    if (!r.ok) throw new Error('failed');
    expect(r.value.slides[0]).toEqual({
      id: 1,
      kind: 'layout',
      durationSec: 12,
      pinned: true,
      layout: 'title-content',
      tone: 'alert',
      title: 's1',
      subtext: null,
      content1Html: '<p>a</p>',
      content2Html: '',
    });
  });

  it('画像スライドは画像を添付に変換し、未登録はnull', async () => {
    setup({
      signage_slides: docs([
        slide(1, { kind: 'image', image: { id: 4, filename: 'a.png' } }),
        slide(2, { kind: 'campus_map', image: null }),
      ]),
    });
    const r = await getSignageSnapshot();
    if (!r.ok) throw new Error('failed');
    expect(r.value.slides[0]).toMatchObject({
      kind: 'image',
      image: { id: '4' },
    });
    expect(r.value.slides[1]).toMatchObject({
      kind: 'campus_map',
      image: null,
    });
  });

  it('落とし物は拾得時刻の新しい順', async () => {
    setup({
      lost_items: docs([
        {
          id: 1,
          name: 'a',
          found_place: 'p',
          found_at: '2026-11-14T01:00:00Z',
          photo: null,
          ...base,
        },
        {
          id: 2,
          name: 'b',
          found_place: 'p',
          found_at: '2026-11-14T03:00:00Z',
          photo: 7,
          ...base,
        },
      ]),
    });
    const r = await getSignageSnapshot();
    if (!r.ok) throw new Error('failed');
    expect(r.value.lostItems.map((i) => i.id)).toEqual([2, 1]);
    expect(r.value.lostItems[0]).toMatchObject({
      foundPlace: 'p',
      photoId: '7',
    });
  });

  it('協賛は種別重複を畳んで正規化し、TTLと全件指定で取得する', async () => {
    setup();
    const r = await getSignageSnapshot();
    if (!r.ok) throw new Error('failed');
    expect(r.value.sponsors).toEqual([
      { id: 1, name: 'A社', logoId: '5', tier: 'planA' },
      { id: 2, name: 'B社', logoId: null, tier: null },
    ]);
    expect(r.value.eventDays).toHaveLength(1);
    expect(getSponsors).toHaveBeenCalledWith({
      ttlSeconds: SIGNAGE_TTL_SECONDS,
    });
    expect(findMany).toHaveBeenCalledWith(
      'telops',
      expect.objectContaining({ limit: 0 }),
      { ttlSeconds: SIGNAGE_TTL_SECONDS },
    );
  });

  it.each([
    ['signage_slides'],
    ['telops'],
    ['lost_items'],
    ['stages'],
    ['performance_slots'],
  ])('%s の取得失敗は全体の失敗', async (collection) => {
    setup({ [collection]: fail });
    expect((await getSignageSnapshot()).ok).toBe(false);
  });

  it('festival_meta・協賛・駐車場の取得失敗は全体の失敗', async () => {
    setup();
    findGlobal.mockResolvedValue(fail);
    expect((await getSignageSnapshot()).ok).toBe(false);
    setup();
    getSponsors.mockResolvedValue({ ok: false });
    expect((await getSignageSnapshot()).ok).toBe(false);
    setup();
    getParkingResponse.mockResolvedValue(fail);
    expect((await getSignageSnapshot()).ok).toBe(false);
  });
});
