import { describe, expect, it } from 'vitest';
import {
  activeServiceIds,
  campusBoundOn,
  departuresOn,
  selectVersion,
  type BusCampusBoundDeparture,
  type BusScheduledDeparture,
  type BusService,
  type BusTimetableFile,
  type BusTimetableVersion,
} from './bus-timetable';

const NONE = [false, false, false, false, false, false, false] as const;

function service(over: Partial<BusService> & { id: string }): BusService {
  return {
    weekdays: NONE,
    startDate: '2026-09-19',
    endDate: '2027-03-31',
    added: [],
    removed: [],
    ...over,
  };
}

function dep(over: Partial<BusScheduledDeparture>): BusScheduledDeparture {
  return {
    tripId: 't',
    serviceId: '平日',
    route: '22A',
    destination: '前橋駅',
    via: null,
    direction: 'maebashi',
    stop: 'gunma_univ_aramaki',
    stopSequence: 1,
    time: '08:00',
    ...over,
  };
}

function cb(over: Partial<BusCampusBoundDeparture>): BusCampusBoundDeparture {
  return {
    tripId: 'c',
    serviceId: '平日',
    route: '22B',
    time: '09:00',
    alightStop: 'gunma_univ_aramaki',
    ...over,
  };
}

function version(over: Partial<BusTimetableVersion>): BusTimetableVersion {
  return {
    version: '20260919',
    validFrom: '2026-09-19',
    validTo: '2027-03-31',
    services: [
      service({
        id: '平日',
        weekdays: [true, true, true, true, true, false, false],
      }),
      service({
        id: '土曜',
        weekdays: [false, false, false, false, false, true, false],
      }),
      service({
        id: '日祝',
        weekdays: [false, false, false, false, false, false, true],
        added: ['2026-11-23', '2026-12-29'],
        removed: ['2026-12-27'],
      }),
    ],
    departures: [
      dep({ tripId: 'w', serviceId: '平日' }),
      dep({ tripId: 's', serviceId: '土曜' }),
      dep({ tripId: 'h', serviceId: '日祝' }),
    ],
    campusBound: [
      cb({ tripId: 's2', serviceId: '土曜', time: '10:30' }),
      cb({ tripId: 's1', serviceId: '土曜', time: '09:17' }),
      cb({ tripId: 'h1', serviceId: '日祝', time: '09:20' }),
    ],
    ...over,
  };
}

const file = (...versions: BusTimetableVersion[]): BusTimetableFile => ({
  fetchedAt: '2026-10-30T00:00:00Z',
  versions,
});

describe('selectVersion', () => {
  const f = file(version({}));
  it('期間の境界日を含む', () => {
    expect(selectVersion(f, '2026-09-19')?.version).toBe('20260919');
    expect(selectVersion(f, '2027-03-31')?.version).toBe('20260919');
  });
  it('期間の外は null', () => {
    expect(selectVersion(f, '2026-09-18')).toBeNull();
    expect(selectVersion(f, '2027-04-01')).toBeNull();
  });
  it('2 版が重なる日は validFrom が新しい方', () => {
    const f2 = file(
      version({
        version: 'old',
        validFrom: '2026-09-19',
        validTo: '2026-12-31',
      }),
      version({
        version: 'new',
        validFrom: '2026-11-01',
        validTo: '2027-03-31',
      }),
    );
    expect(selectVersion(f2, '2026-10-31')?.version).toBe('old');
    expect(selectVersion(f2, '2026-11-01')?.version).toBe('new');
    expect(selectVersion(f2, '2026-12-31')?.version).toBe('new');
  });
});

describe('activeServiceIds', () => {
  const v = version({});
  const ids = (d: string) => [...activeServiceIds(v, d)];
  it('2026-11-14 は土曜、2026-11-15 は日祝', () => {
    expect(ids('2026-11-14')).toEqual(['土曜']);
    expect(ids('2026-11-15')).toEqual(['日祝']);
  });
  it('平日', () => {
    expect(ids('2026-11-16')).toEqual(['平日']);
  });
  it('祝日の例外で追加される', () => {
    expect(ids('2026-11-23')).toContain('日祝');
    expect(ids('2026-11-23')).toContain('平日');
  });
  it('年末年始の例外で除外・追加される', () => {
    expect(ids('2026-12-27')).toEqual([]);
    expect(ids('2026-12-29')).toContain('日祝');
  });
  it('サービスの期間外は曜日が合っても無効', () => {
    expect(ids('2027-04-03')).toEqual([]);
  });
});

describe('departuresOn', () => {
  const f = file(version({}));
  it('その日の運行日区分の発車だけ返す', () => {
    expect(departuresOn(f, '2026-11-14').map((d) => d.tripId)).toEqual(['s']);
    expect(departuresOn(f, '2026-11-15').map((d) => d.tripId)).toEqual(['h']);
  });
  it('版が無い日は空', () => {
    expect(departuresOn(f, '2028-01-01')).toEqual([]);
  });
});

describe('campusBoundOn', () => {
  const f = file(version({}));
  it('同じ版・運行日で絞り、前橋駅の発車時刻順に返す', () => {
    expect(campusBoundOn(f, '2026-11-14').map((d) => d.tripId)).toEqual([
      's1',
      's2',
    ]);
    expect(campusBoundOn(f, '2026-11-15').map((d) => d.tripId)).toEqual(['h1']);
  });
  it('版が無い日は空', () => {
    expect(campusBoundOn(f, '2028-01-01')).toEqual([]);
  });
});
