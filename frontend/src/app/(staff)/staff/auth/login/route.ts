import { redirectResponse } from '@/lib/staff-redirect';
import { readStampEnv } from '@/lib/cloudflare-env';
import { startStaffLogin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const read = await readStampEnv();
  if (!read.ok) return redirectResponse(request, '/staff/auth/failed');
  try {
    const { location, cookies } = await startStaffLogin(request, read.env);
    return redirectResponse(request, location, cookies);
  } catch {
    return redirectResponse(request, '/staff/auth/failed');
  }
}
