import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="min-w-0 flex-1">{children}</div>
      <Footer />
    </>
  );
}
