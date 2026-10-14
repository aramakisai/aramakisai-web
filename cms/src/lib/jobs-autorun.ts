// Payload 3.x のジョブ取得には排他がなく、全レプリカが autoRun すると同じジョブを複数 Pod が
// 同時に実行する。本番は web 用 Pod で CMS_JOBS_AUTORUN=false を付け、worker の 1 Pod だけで回す。
// vitest はプロセス全体に VITEST=true を設定する。テストは payload.jobs.run() を明示的に呼ぶ。
export const shouldAutoRun = (): boolean =>
  !process.env.VITEST && process.env.CMS_JOBS_AUTORUN !== 'false';
