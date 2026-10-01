import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)

const OPEN_DAYS = ['2026-11-01T12:00:00.000Z']
const RING = [
  [139.0, 35.0],
  [139.1, 35.0],
  [139.1, 35.1],
  [139.0, 35.0],
]

describe.skipIf(!hasDatabase)('学生企画のカテゴリ別配置・出店日', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>
  const suffix = `pl-${process.pid}`
  const created: { collection: 'users' | 'student_exhibitions' | 'map_areas'; id: number }[] = []
  let areaId: number

  const make = async (collection: 'users' | 'student_exhibitions' | 'map_areas', data: object) => {
    const doc = (await payload.create({
      collection,
      data: data as never,
      overrideAccess: true,
    })) as { id: number }
    created.push({ collection, id: doc.id })
    return doc
  }
  const makeOwner = (n: string) =>
    make('users', { email: `${n}-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' })
  const content = (extra: object = {}) => ({ name: 'n', description: 'd', ...extra })
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

  it('学生団体は出店日が空だと保存できない', async () => {
    const owner = await makeOwner('student')
    const exhibition = await make('student_exhibitions', {
      owner: owner.id,
      categories: ['other'],
      status: 'draft',
    })
    const user = (await payload.findByID({ collection: 'users', id: owner.id, overrideAccess: true })) as never
    const errors = await errorsOf(
      payload.update({
        collection: 'student_exhibitions',
        id: exhibition.id,
        data: { organization_name: 'org', other: content({ open_days: [] }) } as never,
        overrideAccess: false,
        user,
      }),
    )
    expect(errors).toContain('other.open_days')
  })

  it('実行委員は出店日が空でも作成・更新できる', async () => {
    const owner = await makeOwner('exec')
    const exhibition = await make('student_exhibitions', {
      owner: owner.id,
      categories: ['vendor'],
      vendor: {},
    })
    const updated = await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { vendor: { name: 'x' } },
      overrideAccess: true,
    })
    expect(updated.vendor?.open_days ?? []).toEqual([])
  })

  it('別企画と同じエリア・ブース番号は同一カテゴリ列で拒否する', async () => {
    const a = await makeOwner('a')
    const b = await makeOwner('b')
    await make('student_exhibitions', {
      owner: a.id,
      categories: ['vendor'],
      vendor: { area_id: areaId, booth_number: 1, open_days: OPEN_DAYS },
    })
    const errors = await errorsOf(
      payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: b.id,
          categories: ['vendor'],
          vendor: { area_id: areaId, booth_number: 1, open_days: OPEN_DAYS },
        } as never,
        overrideAccess: true,
      }),
    )
    expect(errors).toEqual(['vendor.booth_number'])
  })

  it('同一企画内の別カテゴリが同じエリア・ブース番号でも拒否する', async () => {
    const owner = await makeOwner('same')
    const errors = await errorsOf(
      payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: owner.id,
          categories: ['exhibit', 'other'],
          exhibit: { area_id: areaId, booth_number: 2, open_days: OPEN_DAYS },
          other: { area_id: areaId, booth_number: 2, open_days: OPEN_DAYS },
        } as never,
        overrideAccess: true,
      }),
    )
    expect(errors).toEqual(['other.booth_number'])
  })

  it('エリアが同じでもブース番号が違えば保存できる', async () => {
    const owner = await makeOwner('ok')
    await make('student_exhibitions', {
      owner: owner.id,
      categories: ['exhibit', 'other'],
      exhibit: { area_id: areaId, booth_number: 3, open_days: OPEN_DAYS },
      other: { area_id: areaId, booth_number: 4, open_days: OPEN_DAYS },
    })
  })
})
