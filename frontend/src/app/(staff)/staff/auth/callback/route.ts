import { redirectResponse } from '@/lib/staff-redirect';
import { readStampEnv } from '@/lib/cloudflare-env';
import { handleStaffCallback } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const read = await readStampEnv();
  if (!read.ok) return redirectResponse(request, '/staff/auth/failed');
  const result = await handleStaffCallback(request, read.env);
  if (result.kind === 'ok') {
    return redirectResponse(request, result.location, result.cookies);
  }
  return redirectResponse(
    request,
    result.kind === 'forbidden'
      ? '/staff/auth/forbidden'
      : '/staff/auth/failed',
  );
}
