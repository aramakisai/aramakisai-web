import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  localSponsorMapConstraint,
  validateLocalSponsorMap,
} from './local-sponsor-map'

const completeLocal = {
  type: ['local'],
  name: 'テスト専用地域協賛',
  business_category: 'hospital',
  local_latitude: 90,
  local_longitude: 180,
}

afterEach(() => vi.unstubAllGlobals())

describe('validateLocalSponsorMap', () => {
  it('カテゴリと座標の標準検証をPayload select/number fieldへ委ねる', () => {
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        business_category: 'unknown',
        local_latitude: Number.NaN,
        local_longitude: 180.1,
      }),
    ).toEqual([])
  })

  it('URLはhttp/httpsだけを許可する', () => {
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        url: 'javascript:alert(1)',
      }),
    ).toEqual([
      {
        field: 'url',
        message: 'Webサイト URL は http または https の絶対URLにしてください',
      },
    ])
  })

  it('追加項目のない既存localとlocal以外を妨げない', () => {
    expect(validateLocalSponsorMap({ type: ['local'], name: '既存レコード' })).toEqual([])
    expect(
      validateLocalSponsorMap({
        type: ['ad', 'vendor'],
        name: '既存の他種別',
        url: 'not-a-url',
        business_category: 'unknown',
        local_latitude: 999,
      }),
    ).toEqual([])
  })
})

describe('localSponsorMapConstraint', () => {
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
          business_category: 'education',
        },
        operation: 'create',
      } as never),
    ).resolves.toMatchObject({
      local_latitude: 36.43068,
      local_longitude: 139.044795,
    })
  })

  it('管理画面相当で旧座標がdataにあっても住所変更時は再geocodeする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ geometry: { coordinates: [139.0, 36.0] } }]),
      }),
    )

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
          business_category: 'education',
          local_latitude: 36.43068,
          local_longitude: 139.044795,
        },
        operation: 'update',
      } as never),
    ).resolves.toMatchObject({ local_latitude: 36, local_longitude: 139 })
  })

  it('住所検索に失敗した場合は住所fieldの検証エラーにする', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }))

    await expect(
      localSponsorMapConstraint({
        data: {
          type: ['local'],
          address: '検索できないテスト住所',
          business_category: 'shop',
        },
        operation: 'create',
      } as never),
    ).rejects.toMatchObject({ data: expect.objectContaining({ errors: expect.any(Array) }) })
  })
})
