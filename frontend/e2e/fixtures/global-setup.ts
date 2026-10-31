import { startCmsFixtureServer } from './cms-fixture-server';

const CMS_ORIGIN = 'http://127.0.0.1:18055';
const APP_ORIGIN = 'http://127.0.0.1:3011';

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (
    process.env.NEXT_PUBLIC_CMS_URL !== CMS_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL !== APP_ORIGIN ||
    process.env.E2E_BASE_URL !== APP_ORIGIN
  ) {
    throw new Error('fixture CMS は専用の loopback 環境でのみ起動できます');
  }
  const server = await startCmsFixtureServer();
  return () =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
}
