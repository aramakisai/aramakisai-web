import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!hasDatabase)('出演枠の時刻検証 (performanceTimeConstraint)', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>
  let stageA: { id: number }
  let stageB: { id: number }
  let originalEventDays: unknown
  const created: number[] = []
  const suffix = String(process.pid)

  const jst = (day: string, hhmm: string) => `${day}T${hhmm}:00+09:00`
  const slot = (stage: number, day: string, start: string, end: string, title = `t-${suffix}`) => ({
    stage_id: stage,
    event_date: `${day}T12:00:00.000Z`,
    start_at: jst(day, start),
    end_at: jst(day, end),
    title,
  })
  // Payload の ValidationError.message は項目名だけなので、理由文は data.errors から取り出す
  const reasons = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (e: { data?: { errors?: { message: string }[] } }) => e,
    )
    expect(error).not.toBeNull()
    return (error?.data?.errors ?? []).map((e) => e.message).join('\n')
  }
  const create = async (data: ReturnType<typeof slot>) => {
    const doc = (await payload.create({
      collection: 'performance_slots',
      data,
      overrideAccess: true,
    })) as { id: number }
    created.push(doc.id)
    return doc
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('../payload.config')).default
    payload = await getPayload({ config })

    const meta = await payload.findGlobal({ slug: 'festival_meta', depth: 0 })
    originalEventDays = meta.event_days
    await payload.updateGlobal({
      slug: 'festival_meta',
      data: {
        name: meta.name || 'test',
        event_days: [
          { start_at: jst('2026-09-19', '09:00'), end_at: jst('2026-09-19', '18:00') },
          { start_at: jst('2026-09-20', '09:00'), end_at: jst('2026-09-20', '18:00') },
        ],
      },
      overrideAccess: true,
    })
    const mk = async (name: string) =>
      (await payload.create({
        collection: 'stages',
        data: { name: `${name}-${suffix}` },
        overrideAccess: true,
      })) as { id: number }
    stageA = await mk('stage-a')
    stageB = await mk('stage-b')
  })

  afterAll(async () => {
    if (!payload) return
    for (const id of created) {
      await payload
        .delete({ collection: 'performance_slots', id, overrideAccess: true })
        .catch(() => null)
    }
    for (const s of [stageA, stageB]) {
      if (s?.id)
        await payload
          .delete({ collection: 'stages', id: s.id, overrideAccess: true })
          .catch(() => null)
    }
    await payload
      .updateGlobal({
        slug: 'festival_meta',
        data: { event_days: originalEventDays as never },
        overrideAccess: true,
      })
      .catch(() => null)
  })

  it('終了が開始以前の出演枠を拒否する', async () => {
    expect(await reasons(create(slot(stageA.id, '2026-09-19', '10:00', '10:00')))).toMatch(
      /終了時刻/,
    )
    expect(await reasons(create(slot(stageA.id, '2026-09-19', '10:00', '09:00')))).toMatch(
      /終了時刻/,
    )
  })

  it('開催日程外の開催日を拒否する', async () => {
    expect(await reasons(create(slot(stageA.id, '2026-09-21', '10:00', '11:00')))).toMatch(/開催日/)
  })

  it('同ステージ同日の重なりを拒否し、名前と時刻を理由に含める', async () => {
    await create(slot(stageA.id, '2026-09-19', '10:00', '11:00', `first-${suffix}`))
    expect(await reasons(create(slot(stageA.id, '2026-09-19', '10:30', '11:30')))).toContain(
      `first-${suffix} 10:00〜11:00`,
    )
  })

  it('接する枠・別ステージ・別日の同時刻は保存できる', async () => {
    await create(slot(stageA.id, '2026-09-19', '11:00', '12:00'))
    await create(slot(stageB.id, '2026-09-19', '10:00', '11:00'))
    await create(slot(stageA.id, '2026-09-20', '10:00', '11:00'))
  })

  it('更新時は一部のフィールドだけでも判定し、自分自身とは重ならない', async () => {
    const doc = await create(slot(stageA.id, '2026-09-19', '13:00', '14:00'))
    const update = (data: Record<string, unknown>) =>
      payload.update({ collection: 'performance_slots', id: doc.id, data, overrideAccess: true })
    await update({ title: `renamed-${suffix}` })
    expect(await reasons(update({ start_at: jst('2026-09-19', '10:30') }))).toMatch(
      /重なっています/,
    )
    expect(await reasons(update({ end_at: jst('2026-09-19', '12:00') }))).toMatch(/終了時刻/)
  })
})
