import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)

const RING = [
  [139.0, 35.0],
  [139.1, 35.0],
  [139.1, 35.1],
  [139.0, 35.0],
]

describe.skipIf(!hasDatabase)('出店協賛の配置・画像枚数', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>
  const suffix = `sv-${process.pid}`
  const created: { collection: 'sponsors' | 'map_areas'; id: number }[] = []
  let areaId: number

  const make = async (collection: 'sponsors' | 'map_areas', data: object) => {
    const doc = (await payload.create({
      collection,
      data: data as never,
      overrideAccess: true,
    })) as { id: number }
    created.push({ collection, id: doc.id })
    return doc
  }
  const errorsOf = async (p: Promise<unknown>) =>
    ((await p.catch((e: unknown) => e)) as { data?: { errors?: { path: string }[] } }).data?.errors?.map(
      (e) => e.path,
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('../payload.config')).default
    payload = await getPayload({ config })
    areaId = (
      await make('map_areas', {
        name: `area-${suffix}`,
        color: '#ff0000',
        geometry: { type: 'MultiPolygon', coordinates: [[RING]] },
      })
    ).id
  })

  afterAll(async () => {
    if (!payload) return
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
  })

  it('別の出店協賛と同じエリア・ブース番号は vendor.booth_number で拒否する', async () => {
    await make('sponsors', {
      name: `a-${suffix}`,
      type: ['vendor'],
      vendor: { area_id: areaId, booth_number: '1' },
    })
    const errors = await errorsOf(
      payload.create({
        collection: 'sponsors',
        data: {
          name: `b-${suffix}`,
          type: ['vendor'],
          vendor: { area_id: areaId, booth_number: '1' },
        } as never,
        overrideAccess: true,
      }),
    )
    expect(errors).toEqual(['vendor.booth_number'])
  })

  it('ブース番号が違えば同じエリアでも保存できる', async () => {
    await make('sponsors', {
      name: `c-${suffix}`,
      type: ['vendor'],
      vendor: { area_id: areaId, booth_number: '2' },
    })
  })

  it('6 枚目の画像は vendor.images で拒否する', async () => {
    const errors = await errorsOf(
      payload.create({
        collection: 'sponsors',
        data: { name: `d-${suffix}`, type: ['vendor'], vendor: { images: [1, 2, 3, 4, 5, 6] } } as never,
        overrideAccess: true,
      }),
    )
    expect(errors).toEqual(['vendor.images'])
  })
})
