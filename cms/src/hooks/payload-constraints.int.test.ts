import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('カテゴリと出演枠の整合 (stageAssignmentConstraint / stageCategoryConstraint)', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let stageOwner: { id: number };
  let otherOwner: { id: number };
  let stageExhibition: { id: number };
  let nonStageExhibition: { id: number };
  let stage: { id: number };
  let timeSlotA: { id: number };
  let timeSlotB: { id: number };
  let createdSlot: number | undefined;

  const suffix = String(process.pid);

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    const createExhibitor = async (email: string) =>
      (await payload.create({
        collection: 'users',
        data: { email, password: 'test-password', role: 'student_exhibitor' },
        overrideAccess: true,
      })) as { id: number };

    stageOwner = await createExhibitor(`stage-owner-${suffix}@test.local`);
    otherOwner = await createExhibitor(`nonstage-owner-${suffix}@test.local`);

    stageExhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: stageOwner.id,
        organization_name: `stage-${suffix}`,
        status: 'draft',
        categories: ['stage'],
        stage: { name: `stage-${suffix}` },
      },
      overrideAccess: true,
    })) as { id: number };

    nonStageExhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: otherOwner.id,
        organization_name: `nonstage-${suffix}`,
        status: 'draft',
        categories: ['exhibit'],
        exhibit: { name: `nonstage-${suffix}` },
      },
      overrideAccess: true,
    })) as { id: number };

    stage = (await payload.create({
      collection: 'stages',
      data: { name: `stage-for-test-${suffix}` },
      overrideAccess: true,
    })) as { id: number };

    timeSlotA = (await payload.create({
      collection: 'time_slots',
      data: { label: `A-${suffix}`, start_at: '2026-09-19T10:00:00.000Z', end_at: '2026-09-19T10:30:00.000Z' },
      overrideAccess: true,
    })) as { id: number };

    timeSlotB = (await payload.create({
      collection: 'time_slots',
      data: { label: `B-${suffix}`, start_at: '2026-09-19T11:00:00.000Z', end_at: '2026-09-19T11:30:00.000Z' },
      overrideAccess: true,
    })) as { id: number };
  });

  afterAll(async () => {
    if (!payload) return;
    if (createdSlot) {
      await payload.delete({ collection: 'performance_slots', id: createdSlot, overrideAccess: true }).catch(() => null);
    }
    for (const id of [timeSlotA?.id, timeSlotB?.id]) {
      if (id) await payload.delete({ collection: 'time_slots', id, overrideAccess: true }).catch(() => null);
    }
    if (stage?.id) {
      await payload.delete({ collection: 'stages', id: stage.id, overrideAccess: true }).catch(() => null);
    }
    for (const id of [stageExhibition?.id, nonStageExhibition?.id]) {
      if (id) {
        await payload.delete({ collection: 'student_exhibitions', id, overrideAccess: true }).catch(() => null);
      }
    }
    for (const id of [stageOwner?.id, otherOwner?.id]) {
      if (id) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => null);
    }
  });

  it('ステージを選択していない企画への出演枠割り当てを拒否する', async () => {
    await expect(
      payload.create({
        collection: 'performance_slots',
        data: { stage_id: stage.id, time_slot_id: timeSlotA.id, exhibition_id: nonStageExhibition.id },
        overrideAccess: true,
      }),
    ).rejects.toThrow();
  });

  it('ステージを選択している企画への出演枠割り当ては通す', async () => {
    const slot = (await payload.create({
      collection: 'performance_slots',
      data: { stage_id: stage.id, time_slot_id: timeSlotA.id, exhibition_id: stageExhibition.id },
      overrideAccess: true,
    })) as { id: number };
    createdSlot = slot.id;
    expect(slot.id).toBeDefined();
  });

  it('出演枠が割り当てられている企画のステージ選択解除を拒否する', async () => {
    await expect(
      payload.update({
        collection: 'student_exhibitions',
        id: stageExhibition.id,
        data: { categories: ['exhibit'], exhibit: { name: `switched-${suffix}` } },
        overrideAccess: true,
      }),
    ).rejects.toThrow();
  });

  it('出演枠を外せばステージ選択の解除が通る', async () => {
    await payload.delete({ collection: 'performance_slots', id: createdSlot as number, overrideAccess: true });
    createdSlot = undefined;

    const updated = await payload.update({
      collection: 'student_exhibitions',
      id: stageExhibition.id,
      data: { categories: ['exhibit'], exhibit: { name: `switched-${suffix}` } },
      overrideAccess: true,
    });
    expect(updated.categories).toEqual(['exhibit']);
  });
});
