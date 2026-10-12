import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('media の非公開化で Cloudflare の purge が積まれる', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let owner: { id: number };
  let media: { id: number; filename?: string | null };
  let exhibition: { id: number };

  const setExhibitionStatus = (status: 'draft' | 'published') =>
    payload.update({ collection: 'student_exhibitions', id: exhibition.id, data: { status }, overrideAccess: true });

  const purgeJobs = () =>
    payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'purgeMediaEdgeCache' } }, limit: 0, depth: 0, overrideAccess: true });

  // レプリカ遅延の猶予 (waitUntil) を待たずに回収できるよう、待機を解除する
  const releaseWait = () =>
    payload.update({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'purgeMediaEdgeCache' } },
      data: { waitUntil: new Date(Date.now() - 1000).toISOString() },
      overrideAccess: true,
    });

  beforeAll(async () => {
    vi.stubEnv('CLOUDFLARE_ZONE_ID', 'zone-int');
    vi.stubEnv('CLOUDFLARE_PURGE_TOKEN', 'token-int');
    vi.stubEnv('CMS_PUBLIC_URL', 'https://cms.example.invalid');

    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-purge-int-'));
    const filePath = path.join(workdir, `purge-${process.pid}.png`);
    await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toFile(filePath);

    owner = (await payload.create({
      collection: 'users',
      data: { email: `purge-${process.pid}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };
    media = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'purge' },
      overrideAccess: true,
      user: owner as never,
    })) as { id: number; filename?: string | null };
    exhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        organization_name: `purge-${process.pid}`,
        status: 'published',
        categories: ['exhibit'],
        exhibit: { name: 'purge', description: 'purge', images: [media.id], open_days: ['2026-11-01T12:00:00.000Z'] },
      },
      overrideAccess: true,
    })) as { id: number };
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    await payload.delete({ collection: 'payload-jobs', where: { taskSlug: { equals: 'purgeMediaEdgeCache' } }, overrideAccess: true }).catch(() => null);
    await payload.delete({ collection: 'student_exhibitions', id: exhibition.id, overrideAccess: true }).catch(() => null);
    await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => null);
    await payload.delete({ collection: 'users', id: owner.id, overrideAccess: true }).catch(() => null);
  });

  it('企画を下書きに戻すと (一括更新経由でも) 画像の purge ジョブが積まれ、実行すると Cloudflare に送る', async () => {
    const used = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(used.used_in_published).toBe(true);
    expect((await purgeJobs()).totalDocs).toBe(0);

    await setExhibitionStatus('draft');
    expect((await purgeJobs()).totalDocs).toBe(1);

    const fetchMock = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await releaseWait();
    await payload.jobs.run({ queue: 'default', allQueues: true, limit: 10, silent: true });
    vi.unstubAllGlobals();

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies).toContainEqual({ prefixes: [`cms.example.invalid/api/media/serve/${media.id}/`] });
    expect(bodies.some((b) => b.files?.some((u: string) => u.endsWith(`/api/media/file/${encodeURIComponent(media.filename!)}`)))).toBe(true);
  });

  it('Cloudflare が失敗しても企画の保存は成功し、ジョブは失敗として残って再試行される', async () => {
    await setExhibitionStatus('published');
    await setExhibitionStatus('draft');
    const queued = (await purgeJobs()).docs.find((job) => !job.completedAt && !job.hasError);
    expect(queued).toBeDefined();

    await releaseWait();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":false}', { status: 500 })));
    await payload.jobs.run({ queue: 'default', allQueues: true, limit: 10, silent: true });
    vi.unstubAllGlobals();

    const after = await payload.findByID({ collection: 'payload-jobs', id: queued!.id, depth: 0, overrideAccess: true });
    expect(after.completedAt).toBeFalsy();
    expect(after.processing).toBeFalsy();
    expect(after.totalTried).toBe(1);
  });
});
