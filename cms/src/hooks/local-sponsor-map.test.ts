import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  localSponsorMapConstraint,
  normalizeLocalSponsorMap,
  validateLocalSponsorMap,
} from './local-sponsor-map'

const completeLocal = {
  type: ['local'],
  name: 'テスト専用地域協賛',
  local_map_category: 'hospital',
  local_latitude: 90,
  local_longitude: 180,
}

afterEach(() => vi.unstubAllGlobals())

describe('validateLocalSponsorMap', () => {
  it('カテゴリと座標の標準検証をPayload select/number fieldへ委ねる', () => {
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        local_map_category: 'unknown',
        local_latitude: Number.NaN,
        local_longitude: 180.1,
      }),
    ).toEqual([])
  })

  it('URLはhttp/httpsだけを許可し、電話番号は文字列のまま保持する', () => {
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        url: 'javascript:alert(1)',
        local_phone: '027-000-0000（内線12）',
      }),
    ).toEqual([
      {
        field: 'url',
        message: 'Webサイト URL は http または https の絶対URLにしてください',
      },
    ])
    expect(
      normalizeLocalSponsorMap({
        ...completeLocal,
        url: ' https://example.invalid/path ',
        local_phone: ' 027-000-0000（内線12） ',
      }),
    ).toMatchObject({
      url: 'https://example.invalid/path',
      local_phone: '027-000-0000（内線12）',
    })
  })

  it('掲載画像にはaltまたは装飾指定のどちらか一方を要求する', () => {
    expect(validateLocalSponsorMap({ ...completeLocal, local_image: 10 })).toEqual([
      {
        field: 'local_image_alt',
        message: '掲載画像には代替テキストまたは装飾画像の指定が必要です',
      },
    ])
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        local_image: 10,
        local_image_alt: 'テスト画像',
      }),
    ).toEqual([])
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        local_image: 10,
        local_image_decorative: true,
      }),
    ).toEqual([])
  })

  it('追加項目のない既存localとlocal以外を妨げない', () => {
    expect(validateLocalSponsorMap({ type: ['local'], name: '既存レコード' })).toEqual([])
    expect(
      validateLocalSponsorMap({
        type: ['ad', 'vendor'],
        name: '既存の他種別',
        url: 'not-a-url',
        local_map_category: 'unknown',
        local_latitude: 999,
      }),
    ).toEqual([])
  })
})

describe('normalizeLocalSponsorMap', () => {
  it('取り込み識別子と任意文字列の空白をnullへ正規化する', () => {
    expect(
      normalizeLocalSponsorMap({
        type: ['local'],
        name: '既存レコード',
        local_import_id: ' ',
        local_business_hours: ' ',
        local_closed_days: ' ',
        local_phone: ' ',
      }),
    ).toMatchObject({
      local_import_id: null,
      local_business_hours: null,
      local_closed_days: null,
      local_phone: null,
    })
  })

  it('既存localの部分更新でも空白をnullへ正規化する', async () => {
    expect(
      await localSponsorMapConstraint({
        data: { local_phone: ' ' },
        originalDoc: { type: ['local'], name: '既存レコード' },
      } as never),
    ).toEqual({ local_phone: null })
  })

  it('住所から座標を自動取得する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ geometry: { coordinates: [139.044795, 36.43068] } }]),
      }),
    )

    await expect(
      localSponsorMapConstraint({
        data: {
          type: ['local'],
          address: '群馬県前橋市荒牧町4丁目2',
          local_map_category: 'education',
        },
        operation: 'create',
      } as never),
    ).resolves.toMatchObject({
      local_latitude: 36.43068,
      local_longitude: 139.044795,
    })
  })

  it('住所変更時でも緯度・経度の両方が明示されていれば同じ値を保持する', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      localSponsorMapConstraint({
        data: {
          address: '変更後のテスト住所',
          local_latitude: 36.43068,
          local_longitude: 139.044795,
        },
        originalDoc: {
          type: ['local'],
          name: '既存レコード',
          address: '変更前のテスト住所',
          local_map_category: 'education',
          local_latitude: 36.43068,
          local_longitude: 139.044795,
        },
        operation: 'update',
      } as never),
    ).resolves.toMatchObject({
      address: '変更後のテスト住所',
      local_latitude: 36.43068,
      local_longitude: 139.044795,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('住所検索に失敗した場合は住所fieldの検証エラーにする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }))

    await expect(
      localSponsorMapConstraint({
        data: {
          type: ['local'],
          address: '検索できないテスト住所',
          local_map_category: 'shop',
        },
        operation: 'create',
      } as never),
    ).rejects.toMatchObject({ data: expect.objectContaining({ errors: expect.any(Array) }) })
  })
})
