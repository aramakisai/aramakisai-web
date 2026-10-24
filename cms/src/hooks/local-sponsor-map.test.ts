import { describe, expect, it } from 'vitest'

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

describe('validateLocalSponsorMap', () => {
  it('6カテゴリと座標境界を受け付ける', () => {
    for (const category of ['hospital', 'life', 'car', 'education', 'food', 'shop']) {
      expect(
        validateLocalSponsorMap({
          ...completeLocal,
          local_map_category: category,
          local_latitude: category === 'hospital' ? -90 : 90,
          local_longitude: category === 'hospital' ? -180 : 180,
        }),
      ).toEqual([])
    }
  })

  it('未知カテゴリ、非有限値、範囲外座標を拒否する', () => {
    expect(
      validateLocalSponsorMap({
        ...completeLocal,
        local_map_category: 'unknown',
        local_latitude: Number.NaN,
        local_longitude: 180.1,
      }).map((error) => error.field),
    ).toEqual(['local_map_category', 'local_latitude', 'local_longitude'])
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
})
