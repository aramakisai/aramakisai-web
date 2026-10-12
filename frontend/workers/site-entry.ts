// @ts-expect-error .open-next/worker.js はビルド時に生成される
import openNext from '../.open-next/worker.js';

interface Env {
  SIGNAGE_HUB: DurableObjectNamespace;
}

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/api/signage/ws') {
      return env.SIGNAGE_HUB.get(
        env.SIGNAGE_HUB.idFromName('signage-hub'),
      ).fetch(request);
    }
    return openNext.fetch(request, env, ctx);
  },
};
export default handler;
