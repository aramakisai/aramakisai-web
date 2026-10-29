import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readStampEnv, type StampEnv } from './cloudflare-env';
import { requireStaff } from './staff-auth';

export type StaffPageAuth =
  | { readonly kind: 'allowed'; readonly env: StampEnv; readonly staff: string }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unavailable' };

// layout では認可できない (ナビゲーション時に再描画されない) ため、各 page.tsx が先頭で呼ぶ。
// path は戻り先に使うため、クエリを含めて渡す
export async function authorizeStaffPage(path: string): Promise<StaffPageAuth> {
  const read = await readStampEnv();
  if (!read.ok) return { kind: 'unavailable' };
  const h = await headers();
  const request = new Request(`http://localhost${path}`, {
    headers: { cookie: h.get('cookie') ?? '' },
  });
  const auth = await requireStaff(request, read.env);
  if (auth.kind === 'login_required') redirect(auth.loginUrl);
  if (auth.kind === 'forbidden') return { kind: 'forbidden' };
  return { kind: 'allowed', env: read.env, staff: auth.staff };
}
