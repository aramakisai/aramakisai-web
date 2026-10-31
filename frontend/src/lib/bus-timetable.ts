export type BusStop = 'gunma_univ_aramaki' | 'driving_school';
export type BusDirection = 'maebashi' | 'shibukawa';

export interface BusService {
  id: string;
  /** 月〜日 */
  weekdays: readonly [
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
  ];
  startDate: string;
  endDate: string;
  added: readonly string[];
  removed: readonly string[];
}

export interface BusScheduledDeparture {
  tripId: string;
  serviceId: string;
  route: string;
  destination: string;
  via: string | null;
  direction: BusDirection;
  stop: BusStop;
  stopSequence: number;
  time: string;
}

export interface BusTimetableVersion {
  version: string;
  validFrom: string;
  validTo: string;
  services: BusService[];
  departures: BusScheduledDeparture[];
}

export interface BusTimetableFile {
  fetchedAt: string;
  versions: BusTimetableVersion[];
}

// 'YYYY-MM-DD' は辞書順が日付順と一致するので文字列比較で足りる
export function selectVersion(
  file: BusTimetableFile,
  date: string,
): BusTimetableVersion | null {
  let best: BusTimetableVersion | null = null;
  for (const v of file.versions) {
    if (v.validFrom <= date && date <= v.validTo) {
      if (!best || v.validFrom > best.validFrom) best = v;
    }
  }
  return best;
}

// 月曜起点 (0=月 … 6=日)。TZ に依存しないよう UTC で曜日を求める
function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function activeServiceIds(
  version: BusTimetableVersion,
  date: string,
): ReadonlySet<string> {
  const wd = weekdayIndex(date);
  const ids = new Set<string>();
  for (const s of version.services) {
    const regular = s.weekdays[wd] && s.startDate <= date && date <= s.endDate;
    if ((regular || s.added.includes(date)) && !s.removed.includes(date)) {
      ids.add(s.id);
    }
  }
  return ids;
}

export function departuresOn(
  file: BusTimetableFile,
  date: string,
): readonly BusScheduledDeparture[] {
  const version = selectVersion(file, date);
  if (!version) return [];
  const ids = activeServiceIds(version, date);
  return version.departures.filter((d) => ids.has(d.serviceId));
}
