import { cookies } from 'next/headers';
import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCampusMapData, parseCampusMapQuery } from '@/lib/campus-map';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';

interface MapPageProps {
  searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const initialFilters = parseCampusMapQuery(await searchParams);
  const data = await getCampusMapData();
  const cookieStore = await cookies();
  const { phase } = resolvePhase(
    cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value,
  );

  return (
    <CampusMapScreen
      data={data}
      initialFilters={initialFilters}
      phase={phase}
    />
  );
}
