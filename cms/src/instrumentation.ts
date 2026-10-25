import { shouldAutoRun } from './lib/jobs-autorun';

// Payload は getPayload({ cron: true }) が呼ばれて初めて autoRun cron を起動する。
// worker に届くのは Payload に触れない /api/health だけなので、起動時に明示的に初期化する。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !shouldAutoRun()) return;
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('./payload.config'),
  ]);
  await getPayload({ config, cron: true });
}
