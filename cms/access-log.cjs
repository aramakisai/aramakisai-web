const dc = require('node:diagnostics_channel');

const started = new WeakMap();

dc.subscribe('http.server.request.start', ({ request }) => {
  started.set(request, process.hrtime.bigint());
});

dc.subscribe('http.server.response.finish', ({ request, response }) => {
  const start = started.get(request);
  if (start === undefined) return;
  // クエリ文字列に招待トークンなどが載るため pathname だけを出す
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/health') return;
  const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10;
  process.stdout.write(`${JSON.stringify({ method: request.method, path, status: response.statusCode, ms })}\n`);
});
