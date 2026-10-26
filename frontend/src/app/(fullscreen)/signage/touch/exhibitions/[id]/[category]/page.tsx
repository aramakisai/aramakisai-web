import { ExhibitionDetailBody } from '@/components/exhibition-detail-body';
import { loadExhibitionDetailPage } from '@/lib/exhibition-detail-page';

export function generateStaticParams() {
  return [];
}

export const revalidate = 300;

export default async function TouchExhibitionPage({
  params,
}: {
  readonly params: Promise<{ id: string; category: string }>;
}) {
  const { id, category } = await params;
  const { exhibition, areas, performances, openDays } =
    await loadExhibitionDetailPage(id, category);

  return (
    <main className="min-h-dvh bg-background px-6 pt-6 pb-[240px]">
      <ExhibitionDetailBody
        exhibition={exhibition}
        areas={areas}
        performances={performances}
        openDays={openDays}
        variant="signage"
      />
    </main>
  );
}
