import { cookies } from 'next/headers';
import { Header, MAIN_CONTENT_ID } from '@/components/header';
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
      <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1">
        {children}
      </main>
      <Footer phase={phase} />
    </>
  );
}
