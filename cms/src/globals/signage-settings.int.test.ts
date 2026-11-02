import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!hasDatabase)('サイネージ設定の固定と試験運転 (signage_settings)', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>
  let originalEventDays: unknown
  const slideIds: number[] = []
  const suffix = String(process.pid)

  const jst = (day: string, hhmm: string) => `${day}T${hhmm}:00+09:00`
  const eventDays = [
    { start_at: jst('2026-09-19', '09:00'), end_at: jst('2026-09-19', '18:00') },
    { start_at: jst('2026-09-20', '09:00'), end_at: jst('2026-09-20', '18:00') },
  ]
  const settings = () => payload.findGlobal({ slug: 'signage_settings', depth: 0, overrideAccess: true })
  const save = (data: Record<string, unknown>) =>
    payload.updateGlobal({ slug: 'signage_settings', data: data as never, overrideAccess: true })
  const createSlide = async () => {
    const doc = (await payload.create({
      collection: 'signage_slides',
      data: { kind: 'timetable', title: `trial-${suffix}-${slideIds.length}` } as never,
      overrideAccess: true,
    })) as { id: number }
    slideIds.push(doc.id)
    return doc.id
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('../payload.config')).default
    payload = await getPayload({ config })
    const meta = await payload.findGlobal({ slug: 'site_settings', depth: 0 })
    originalEventDays = meta.event_days
    await payload.updateGlobal({
      slug: 'site_settings',
      data: { name: meta.name || 'test', event_days: eventDays },
      overrideAccess: true,
    })
    await save({ pinned_slide: null, trial_run: { start_at: null } })
  })

  afterAll(async () => {
    if (!payload) return
    await save({ pinned_slide: null, trial_run: { start_at: null } }).catch(() => null)
    for (const id of slideIds) {
      await payload.delete({ collection: 'signage_slides', id, overrideAccess: true }).catch(() => null)
    }
    await payload
      .updateGlobal({ slug: 'site_settings', data: { event_days: originalEventDays as never }, overrideAccess: true })
      .catch(() => null)
  })

  it('固定の保存と試験運転の保存を交互に行っても互いの値が消えず、固定の保存で起点が変わらない', async () => {
    const slide = await createSlide()
    await save({ trial_run: { start_at: jst('2026-09-19', '10:00') } })
    const started = await settings()
    const anchoredAt = started.trial_run?.anchored_at
    expect(anchoredAt).toBeTruthy()

    await sleep(1100)
    await save({ pinned_slide: slide })
    const pinned = await settings()
    expect(pinned.trial_run?.start_at).toBe(started.trial_run?.start_at)
    expect(pinned.trial_run?.anchored_at).toBe(anchoredAt)

    await save({ trial_run: { start_at: jst('2026-09-20', '11:00') } })
    const restarted = await settings()
    expect(typeof restarted.pinned_slide === 'object' ? restarted.pinned_slide?.id : restarted.pinned_slide).toBe(slide)
    expect(new Date(restarted.trial_run?.start_at as string).getTime()).toBe(Date.parse(jst('2026-09-20', '11:00')))
    expect(restarted.trial_run?.anchored_at).not.toBe(anchoredAt)

    await save({ pinned_slide: null })
    const unpinned = await settings()
    expect(unpinned.trial_run?.anchored_at).toBe(restarted.trial_run?.anchored_at)
  })

  it('試験中に開催日程を変えた後でも、スライドの無効化が成功し固定が外れ、試験運転も続く', async () => {
    const slide = await createSlide()
    await save({ pinned_slide: slide, trial_run: { start_at: jst('2026-09-19', '10:00') } })
    await payload.updateGlobal({
      slug: 'site_settings',
      data: { event_days: [{ start_at: jst('2026-10-01', '09:00'), end_at: jst('2026-10-01', '18:00') }] },
      overrideAccess: true,
    })
    try {
      await payload.update({ collection: 'signage_slides', id: slide, data: { enabled: false }, overrideAccess: true })
      const after = await settings()
      expect(after.pinned_slide).toBeNull()
      expect(after.trial_run?.start_at).toBeTruthy()
      expect(after.trial_run?.anchored_at).toBeTruthy()
    } finally {
      await payload.updateGlobal({
        slug: 'site_settings',
        data: { event_days: eventDays },
        overrideAccess: true,
      })
    }
  })

  it('試験内の開始日時を null で送ると終了できる', async () => {
    await save({ trial_run: { start_at: jst('2026-09-19', '10:00') } })
    await save({ trial_run: { start_at: null } })
    const ended = await settings()
    expect(ended.trial_run?.start_at).toBeNull()
    expect(ended.trial_run?.anchored_at).toBeNull()
  })
})
