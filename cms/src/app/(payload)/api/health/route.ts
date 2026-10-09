// K8s の readiness / liveness 共用。DB には触れない: DB の switchover で全 Pod が
// 受付から外れて全停止になるのを避けるため、プロセスが HTTP を返せることだけを示す。
// catch-all の `api/[...slug]` (Payload REST) より具体的なパスが優先されるので認証を通らない。
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
