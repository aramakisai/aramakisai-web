import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCampusMapData, parseCampusMapQuery } from '@/lib/campus-map';

interface MapPageProps {
  searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const initialFilters = parseCampusMapQuery(await searchParams);
  const data = await getCampusMapData();

  return <CampusMapScreen data={data} initialFilters={initialFilters} />;
}
