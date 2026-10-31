import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import { strFromU8, unzipSync } from 'fflate';
import type {
  BusDirection,
  BusScheduledDeparture,
  BusService,
  BusStop,
  BusTimetableFile,
  BusTimetableVersion,
} from '../src/lib/bus-timetable';

const DATASET_URL =
  'https://ckan.odpt.org/dataset/kan_etsu_transportation_all_lines';
const zipUrl = (date: string) =>
  `https://api-public.odpt.org/api/v4/files/odpt/Kan_etsuTransportation/AllLines.zip?date=${date}`;

const OUT_PATH = path.resolve(__dirname, '../src/data/bus-timetable.json');

const TARGET_STOPS: Record<string, BusStop> = {
  '200273_01': 'gunma_univ_aramaki',
  '200722_01': 'driving_school',
  '200722_02': 'driving_school',
};

// 前橋方面の時刻表が記号を付ける経由 (前橋駅・群馬大学荒牧を除いた残り)
const KNOWN_MAEBASHI_VIA = new Set([
  '',
  '南橘団地・群大病院',
  '群大病院',
  '南橘団地',
]);
const PASS_THROUGH = new Set(['前橋駅', '群馬大学荒牧']);

type Row = Record<string, string>;

export function parseVersionDates(html: string): string[] {
  const dates = new Set(
    [...html.matchAll(/関越交通バス-(\d{8})/g)].map((m) => m[1]),
  );
  if (dates.size === 0) {
    throw new Error('データセットページから版の日付を読み取れませんでした');
  }
  return [...dates].sort();
}

const isoDate = (d: string) =>
  `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

function readCsv(files: Record<string, Uint8Array>, name: string): Row[] {
  const raw = files[name];
  if (!raw) throw new Error(`${name} が zip に含まれていません`);
  return parse(strFromU8(raw), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });
}

function splitHeadsign(headsign: string): {
  destination: string;
  via: string | null;
} {
  const m = /^(.*?)（(.*) 経由）$/.exec(headsign);
  return m
    ? { destination: m[1], via: m[2] }
    : { destination: headsign, via: null };
}

export function extractVersion(
  version: string,
  zip: Uint8Array,
): BusTimetableVersion {
  const files = unzipSync(zip);
  const info = readCsv(files, 'feed_info.txt')[0];
  if (!info?.feed_start_date || !info.feed_end_date) {
    throw new Error(`${version}: feed_info.txt に有効期間がありません`);
  }

  const routes = new Map(
    readCsv(files, 'routes.txt').map((r) => [r.route_id, r.route_long_name]),
  );
  const trips = new Map(readCsv(files, 'trips.txt').map((t) => [t.trip_id, t]));

  const seenStops = new Set<string>();
  const departures: BusScheduledDeparture[] = [];
  for (const st of readCsv(files, 'stop_times.txt')) {
    const stop = TARGET_STOPS[st.stop_id];
    if (!stop) continue;
    seenStops.add(st.stop_id);
    if (st.pickup_type === '1') continue;
    const trip = trips.get(st.trip_id);
    if (!trip)
      throw new Error(`${version}: trips.txt に ${st.trip_id} がありません`);
    if (trip.direction_id !== '0' && trip.direction_id !== '1') {
      throw new Error(
        `${version}: ${st.trip_id} の direction_id が想定外です (${trip.direction_id})`,
      );
    }
    const direction: BusDirection =
      trip.direction_id === '1' ? 'maebashi' : 'shibukawa';
    const { destination, via } = splitHeadsign(
      st.stop_headsign || trip.trip_headsign,
    );
    if (direction === 'maebashi') {
      const rest = (via ?? '')
        .split('・')
        .filter((p) => !PASS_THROUGH.has(p))
        .join('・');
      if (!KNOWN_MAEBASHI_VIA.has(rest)) {
        throw new Error(
          `${version}: ${st.trip_id} の経由「${via}」が記号表にありません。記号を追加してください`,
        );
      }
    }
    departures.push({
      tripId: st.trip_id,
      serviceId: trip.service_id,
      route: (routes.get(trip.route_id) ?? '').split(/\s/)[0],
      destination,
      via,
      direction,
      stop,
      stopSequence: Number(st.stop_sequence),
      time: st.departure_time.slice(0, 5),
    });
  }
  const missing = Object.keys(TARGET_STOPS).filter((id) => !seenStops.has(id));
  if (missing.length > 0) {
    throw new Error(
      `${version}: 対象停留所が見つかりません (${missing.join(', ')})`,
    );
  }

  departures.sort(
    (a, b) =>
      a.time.localeCompare(b.time) ||
      a.stop.localeCompare(b.stop) ||
      a.tripId.localeCompare(b.tripId) ||
      a.stopSequence - b.stopSequence,
  );

  const used = new Set(departures.map((d) => d.serviceId));
  const exceptions = readCsv(files, 'calendar_dates.txt');
  const dates = (id: string, type: string) =>
    exceptions
      .filter((e) => e.service_id === id && e.exception_type === type)
      .map((e) => isoDate(e.date))
      .sort();
  const calendar = readCsv(files, 'calendar.txt').filter((c) =>
    used.has(c.service_id),
  );
  const regular: BusService[] = calendar.map((c) => ({
    id: c.service_id,
    weekdays: [
      c.monday,
      c.tuesday,
      c.wednesday,
      c.thursday,
      c.friday,
      c.saturday,
      c.sunday,
    ].map((v) => v === '1') as unknown as BusService['weekdays'],
    startDate: isoDate(c.start_date),
    endDate: isoDate(c.end_date),
    added: dates(c.service_id, '1'),
    removed: dates(c.service_id, '2'),
  }));
  // 年末年始などは calendar.txt に行が無く calendar_dates.txt の追加日だけで定義される
  const inCalendar = new Set(calendar.map((c) => c.service_id));
  const exceptionOnly: BusService[] = [...used]
    .filter((id) => !inCalendar.has(id))
    .map((id) => ({
      id,
      weekdays: [false, false, false, false, false, false, false],
      startDate: isoDate(info.feed_start_date),
      endDate: isoDate(info.feed_end_date),
      added: dates(id, '1'),
      removed: dates(id, '2'),
    }));
  const services = [...regular, ...exceptionOnly].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  return {
    version,
    validFrom: isoDate(info.feed_start_date),
    validTo: isoDate(info.feed_end_date),
    services,
    departures,
  };
}

export function buildTimetableFile(
  versions: BusTimetableVersion[],
  previous: BusTimetableFile | null,
  today: string,
  now: string,
): BusTimetableFile {
  const live = versions
    .filter((v) => v.validTo >= today)
    .sort((a, b) => (a.version < b.version ? -1 : 1));
  if (live.length === 0) {
    throw new Error('有効期間が今日以降の版がありません');
  }
  const unchanged =
    previous !== null &&
    JSON.stringify(previous.versions) === JSON.stringify(live);
  return { fetchedAt: unchanged ? previous.fetchedAt : now, versions: live };
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function main(): Promise<void> {
  const dates = parseVersionDates(await (await fetchOk(DATASET_URL)).text());
  const versions: BusTimetableVersion[] = [];
  for (const d of dates) {
    const zip = new Uint8Array(await (await fetchOk(zipUrl(d))).arrayBuffer());
    versions.push(extractVersion(d, zip));
  }

  const previous = await readFile(OUT_PATH, 'utf8')
    .then((s) => JSON.parse(s) as BusTimetableFile)
    .catch(() => null);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date());
  const file = buildTimetableFile(
    versions,
    previous,
    today,
    new Date().toISOString(),
  );

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(file, null, 2) + '\n');
  console.log(
    `${file.versions.map((v) => v.version).join(', ')} を書き出しました`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
