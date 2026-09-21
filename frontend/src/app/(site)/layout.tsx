import { cookies } from 'next/headers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const { phase } = resolvePhase(cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value);

  return (
    <>
      <Header phase={phase} />
      <div className="min-w-0 flex-1">{children}</div>
      <Footer phase={phase} />
    </>
  );
}
