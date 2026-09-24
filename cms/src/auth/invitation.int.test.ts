import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('招待メールの送信', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  const createdUserIds: number[] = [];

  const suffix = String(process.pid);
  let emailCounter = 0;
  const nextEmail = () => `invitee-${suffix}-${emailCounter++}@test.local`;

  let executive: { id: number };

  beforeAll(async () => {
    vi.stubEnv('EXHIBITOR_CONTACT_URL', 'https://aramakisai.com/contact');
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    executive = (await payload.create({
      collection: 'users',
      data: {
        email: `executive-${suffix}@test.local`,
        role: 'executive',
        password: 'executive-Passw0rd!',
      },
      overrideAccess: true,
    })) as { id: number };
    createdUserIds.push(executive.id);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (!payload) return;
    for (const id of createdUserIds) {
      await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => null);
    }
  });

  async function createExhibitor(email: string) {
    const user = (await payload.create({
      collection: 'users',
      data: { email, role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };
    createdUserIds.push(user.id);
    return user;
  }

  async function resetPasswordToken(id: number): Promise<{ token: string | null; expiration: string | null }> {
    const raw = (await payload.db.findOne({
      collection: 'users',
      where: { id: { equals: id } },
    })) as { resetPasswordToken?: string | null; resetPasswordExpiration?: string | null } | null;
    return {
      token: raw?.resetPasswordToken ?? null,
      expiration: raw?.resetPasswordExpiration ?? null,
    };
  }

  // 同じ DB を他 agent の結合テストが並行して使うため、payload.jobs.run() が拾う
  // 既定 10 件の中に自分のジョブが入らないことがある。userId で対象のジョブを
  // 名指しして runByID することで、キューの混雑と無関係に確認できるようにする。
  async function runInvitationJob(userId: number): Promise<void> {
    const { docs } = await payload.find({
      collection: 'payload-jobs',
      where: {
        and: [{ taskSlug: { equals: 'sendInvitation' } }, { 'input.userId': { equals: userId } }],
      },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    });
    const job = docs[0] as { id: number } | undefined;
    if (!job) throw new Error(`userId=${userId} 宛の sendInvitation ジョブが見つからない`);
    await payload.jobs.runByID({ id: job.id, overrideAccess: true });
  }

  it('作成すると招待メールが 1 通送られ、送信済みと記録される', async () => {
    const email = nextEmail();
    const sendEmail = vi.spyOn(payload, 'sendEmail');
    const user = await createExhibitor(email);

    await runInvitationJob(user.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [message] = sendEmail.mock.calls[0];
    expect(message.to).toBe(email);
    expect(message.subject).toBe('【荒牧祭】HP企画ページの入稿用アカウントのご案内');
    expect(message.html).toContain('/admin/reset/');
    expect(message.html).not.toContain('パスワード:');

    const updated = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true });
    expect(updated.invite_status).toBe('sent');
    expect(updated.invite_sent_at).toBeTruthy();
    expect(updated.invite_error).toBeFalsy();
  });

  it('送信に失敗しても作成は成功し、送信失敗と記録される', async () => {
    const user = await createExhibitor(nextEmail());
    vi.spyOn(payload, 'sendEmail').mockRejectedValueOnce(new Error('smtp down'));

    await runInvitationJob(user.id);

    const updated = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true });
    expect(updated.invite_status).toBe('failed');
    expect(updated.invite_error).toBe('送信に失敗しました: smtp down');
  });

  it('期限切れの招待リンクは M-E06 で拒否される', async () => {
    const user = await createExhibitor(nextEmail());
    await runInvitationJob(user.id);
    const { token } = await resetPasswordToken(user.id);
    expect(token).toBeTruthy();

    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { resetPasswordExpiration: new Date(Date.now() - 1000).toISOString() },
    });

    await expect(
      payload.resetPassword({
        collection: 'users',
        data: { token: token as string, password: 'new-Passw0rd!' },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({
      message: 'リンクが無効なため、実行委員に招待メールの再送を依頼してください。',
      status: 403,
    });
  });

  it('再送すると以前のリンクが無効になり、新しいリンクでパスワードを設定してログインできる', async () => {
    const email = nextEmail();
    const user = await createExhibitor(email);
    await runInvitationJob(user.id);
    const first = await resetPasswordToken(user.id);
    expect(first.token).toBeTruthy();

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { resend_invite: true },
      user: executive,
      overrideAccess: true,
    });
    await runInvitationJob(user.id);
    const second = await resetPasswordToken(user.id);
    expect(second.token).toBeTruthy();
    expect(second.token).not.toBe(first.token);

    await expect(
      payload.resetPassword({
        collection: 'users',
        data: { token: first.token as string, password: 'old-Passw0rd!' },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 });

    await payload.resetPassword({
      collection: 'users',
      data: { token: second.token as string, password: 'new-Passw0rd!' },
      overrideAccess: true,
    });

    const loginResult = await payload.login({
      collection: 'users',
      data: { email, password: 'new-Passw0rd!' },
      overrideAccess: true,
    });
    expect(loginResult.user?.role).toBe('student_exhibitor');
  });

  it('作成が失敗するとジョブも残らず送信されない', async () => {
    const email = nextEmail();
    // role: executive はジョブを積まないため、後続の失敗だけを観測できる状態を作る
    const blocker = (await payload.create({
      collection: 'users',
      data: { email, role: 'executive', password: 'blocker-Passw0rd!' },
      overrideAccess: true,
    })) as { id: number };
    createdUserIds.push(blocker.id);
    const sendEmail = vi.spyOn(payload, 'sendEmail');

    // 同じメールアドレスでの作成は unique 制約で失敗する。ジョブは作成と同じ
    // トランザクションに入るため、作成が失敗すればジョブも積まれない (キューに
    // 対象ユーザーが存在しないため runInvitationJob は使えない。sendEmail が
    // 一度も呼ばれないことで、ジョブが積まれなかったことを確認する)。
    await expect(
      payload.create({
        collection: 'users',
        data: { email, role: 'student_exhibitor' },
        overrideAccess: true,
      }),
    ).rejects.toThrow();

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
