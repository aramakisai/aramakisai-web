import {
  p2pScaleLabel,
  type SignageQuakeObservation,
} from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';

export interface EewArea {
  /** P2P areas[].name、Wolfx WarnArea[].Chiiki */
  readonly name: string;
  /** P2P は scaleFrom の表示名、Wolfx は Shindo1 の文字列のまま */
  readonly intensityFrom: string;
  /** P2P は scaleTo の表示名(99 は「以上」)、Wolfx は Shindo2 の文字列のまま */
  readonly intensityTo: string;
  /** P2P は arrivalTime の文字列(kindCode 11 は「既に到達と予測」、19 は「到達予想なし」)、Wolfx は Time の文字列(Arrive が真なら「既に到達と予測」) */
  readonly arrival: string | null;
}

export interface EewDetail {
  /** Wolfx の isFinal。P2P は持たないため null */
  readonly final: boolean | null;
  readonly hypocenter: string | null;
  readonly magnitude: number | null;
  readonly depth: number | null;
  readonly originTimeText: string | null;
  readonly issuedAtText: string;
  /** 受信した順 */
  readonly areas: readonly EewArea[];
}

export interface EewReport {
  readonly kind: 'eew';
  readonly source: 'p2p' | 'wolfx';
  /** 気象庁の EventID(14桁)。2系統で共通 */
  readonly eventId: string;
  readonly serial: number;
  readonly cancelled: boolean;
  /** 警報か。予報は報にしないため、取消でない報では常に真 */
  readonly warning: boolean;
  /** 対象地域に群馬県を含む警報か */
  readonly gunma: boolean;
  /** 発表時刻(epoch ms) */
  readonly issuedAt: number;
  /** 発生時刻(epoch ms)。取消で無いときは null */
  readonly originTime: number | null;
  readonly training: boolean;
  readonly detail: EewDetail;
}

export interface ObservationReport {
  readonly kind: 'observation';
  readonly source: 'p2p';
  /** `id ?? _id`。Discord の投稿の重複除去だけに使う */
  readonly id: string;
  readonly issuedAt: number;
  readonly originTime: number;
  readonly observation: SignageQuakeObservation;
  /** isArea === false の観測点が1つ以上ある種類の報 */
  readonly hasStations: boolean;
  /** 前橋市の観測点の scale の最大。前橋市が載らなければ null */
  readonly maebashiMaxScale: number | null;
  /** 前橋市の観測点に 46(5弱以上と推定)がある */
  readonly maebashiEstimated: boolean;
  /** 群馬県の観測点(isArea === false)がある */
  readonly gunmaStations: boolean;
  readonly detail: {
    readonly issueType: string;
    readonly magnitude: number | null;
    readonly depth: number | null;
    readonly issuedAtText: string;
  };
  readonly training: boolean;
}

export interface EqlistReport {
  readonly kind: 'eqlist';
  readonly source: 'wolfx';
  readonly eventId: string;
  readonly originTime: number;
  readonly observation: SignageQuakeObservation;
  /** No1 の shindo が "1"〜"4" */
  readonly belowFiveLower: boolean;
  readonly training: boolean;
}

export type QuakeReport = EewReport | ObservationReport | EqlistReport;

type Obj = Record<string, unknown>;

const TIME_RE = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/;

/** `YYYY/MM/DD HH:mm[:ss[.SSS]]` を日本時間として解釈する。解釈できなければ null */
export function parseJstTime(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const m = TIME_RE.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', frac = ''] = m;
  const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${frac}+09:00`);
  return Number.isNaN(ms) ? null : ms;
}

function asObj(v: unknown): Obj | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Obj)
    : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

/** 欠落・-1(P2P の不明)は null */
function positiveNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function parseJson(raw: string): Obj | null {
  try {
    return asObj(JSON.parse(raw));
  } catch {
    return null;
  }
}

const UNKNOWN = '不明';

function p2pArea(a: unknown): EewArea | null {
  const o = asObj(a);
  const name = str(o?.name);
  if (!o || !name) return null;
  const to = o.scaleTo === 99 ? '以上' : p2pScaleLabel(Number(o.scaleTo));
  let arrival: string | null;
  if (o.kindCode === '11') arrival = '既に到達と予測';
  else if (o.kindCode === '19') arrival = '到達予想なし';
  else arrival = str(o.arrivalTime);
  return {
    name,
    intensityFrom: p2pScaleLabel(Number(o.scaleFrom)) ?? UNKNOWN,
    intensityTo: to ?? UNKNOWN,
    arrival,
  };
}

function p2pEew(o: Obj, test: boolean): EewReport | null {
  const issue = asObj(o.issue);
  const eventId = str(issue?.eventId);
  const serial = Number.parseInt(String(issue?.serial), 10);
  const issuedAt = parseJstTime(issue?.time);
  if (!issue || !eventId || Number.isNaN(serial) || issuedAt === null)
    return null;
  const cancelled = o.cancelled === true;
  const eq = asObj(o.earthquake);
  const originText = str(eq?.originTime);
  const originTime = originText === null ? null : parseJstTime(originText);
  if (!cancelled && originTime === null) return null;
  const hypo = asObj(eq?.hypocenter);
  const areas = (Array.isArray(o.areas) ? o.areas : [])
    .map(p2pArea)
    .filter((a): a is EewArea => a !== null);
  return {
    kind: 'eew',
    source: 'p2p',
    eventId,
    serial,
    cancelled,
    warning: !cancelled,
    gunma: areas.some((a) => a.name.startsWith('群馬県')),
    issuedAt,
    originTime,
    training: o.test === true || test,
    detail: {
      final: null,
      hypocenter: str(hypo?.name),
      magnitude: positiveNumber(hypo?.magnitude),
      depth: positiveNumber(hypo?.depth),
      originTimeText: originText,
      issuedAtText: String(issue.time),
      areas,
    },
  };
}

const ISSUE_TYPE_LABELS: Readonly<Record<string, string>> = {
  ScalePrompt: '震度速報',
  Destination: '震源に関する情報',
  ScaleAndDestination: '震源・震度に関する情報',
  DetailScale: '各地の震度に関する情報',
  Foreign: '遠地地震に関する情報',
  Other: 'その他の情報',
};
const NO_STATION_TYPES = ['ScalePrompt', 'Destination', 'Foreign', 'Other'];

function p2pObservation(o: Obj, test: boolean): ObservationReport | null {
  const id = str(o.id) ?? str(o._id);
  const issue = asObj(o.issue);
  const eq = asObj(o.earthquake);
  const issuedAt = parseJstTime(issue?.time);
  const originText = str(eq?.time);
  const originTime = parseJstTime(originText);
  if (!id || !issue || !eq || issuedAt === null || originTime === null)
    return null;
  const type = typeof issue.type === 'string' ? issue.type : '';
  const hypo = asObj(eq.hypocenter);
  const points = (Array.isArray(o.points) ? o.points : [])
    .map(asObj)
    .filter((p): p is Obj => p !== null && p.isArea === false);
  const hasStations = !NO_STATION_TYPES.includes(type) && points.length > 0;
  const stations = hasStations ? points : [];
  const maebashi = stations
    .filter((p) => p.pref === '群馬県' && String(p.addr).startsWith('前橋市'))
    .map((p) => Number(p.scale))
    .filter((s) => !Number.isNaN(s));
  const maebashiMaxScale = maebashi.length > 0 ? Math.max(...maebashi) : null;
  return {
    kind: 'observation',
    source: 'p2p',
    id,
    issuedAt,
    originTime,
    observation: {
      source: 'p2p',
      originTime: originText!,
      hypocenter: str(hypo?.name) ?? '',
      maebashiIntensity:
        maebashiMaxScale === null ? null : p2pScaleLabel(maebashiMaxScale),
      maxIntensity: p2pScaleLabel(Number(eq.maxScale)),
    },
    hasStations,
    maebashiMaxScale,
    maebashiEstimated: maebashi.includes(46),
    gunmaStations: stations.some((p) => p.pref === '群馬県'),
    detail: {
      issueType: ISSUE_TYPE_LABELS[type] ?? (type || UNKNOWN),
      magnitude: positiveNumber(hypo?.magnitude),
      depth: positiveNumber(hypo?.depth),
      issuedAtText: String(issue.time),
    },
    training: o.test === true || test,
  };
}

function normalizeP2p(o: Obj, test: boolean): QuakeReport | null {
  if (o.code === 556) return p2pEew(o, test);
  if (o.code === 551) return p2pObservation(o, test);
  return null;
}

function wolfxArea(a: unknown): (EewArea & { warning: boolean }) | null {
  const o = asObj(a);
  const name = str(o?.Chiiki);
  if (!o || !name) return null;
  return {
    name,
    intensityFrom: str(o.Shindo1) ?? UNKNOWN,
    intensityTo: str(o.Shindo2) ?? UNKNOWN,
    arrival: o.Arrive === true ? '既に到達と予測' : str(o.Time),
    warning: o.Type === 'Warning',
  };
}

function normalizeWolfxEew(o: Obj, test: boolean): EewReport | null {
  if (o.type === 'heartbeat') return null;
  const cancelled = o.isCancel === true;
  const warning = o.isWarn === true;
  if (!cancelled && !warning) return null;
  const eventId = str(o.EventID);
  const serial = typeof o.Serial === 'number' ? o.Serial : Number.NaN;
  const issuedAt = parseJstTime(o.AnnouncedTime);
  if (!eventId || Number.isNaN(serial) || issuedAt === null) return null;
  const originText = str(o.OriginTime);
  const originTime = originText === null ? null : parseJstTime(originText);
  if (!cancelled && originTime === null) return null;
  const areas = (Array.isArray(o.WarnArea) ? o.WarnArea : [])
    .map(wolfxArea)
    .filter((a): a is NonNullable<typeof a> => a !== null);
  return {
    kind: 'eew',
    source: 'wolfx',
    eventId,
    serial,
    cancelled,
    warning,
    gunma: areas.some((a) => a.warning && a.name.startsWith('群馬県')),
    issuedAt,
    originTime,
    training: o.isTraining === true || test,
    detail: {
      final: o.isFinal === true,
      hypocenter: str(o.Hypocenter),
      magnitude: positiveNumber(o.Magnitude ?? o.Magunitude),
      depth: positiveNumber(o.Depth),
      originTimeText: originText,
      issuedAtText: String(o.AnnouncedTime),
      areas: areas.map(({ name, intensityFrom, intensityTo, arrival }) => ({
        name,
        intensityFrom,
        intensityTo,
        arrival,
      })),
    },
  };
}

const WOLFX_SHINDO_LABELS: Readonly<Record<string, string>> = {
  '1': '震度1',
  '2': '震度2',
  '3': '震度3',
  '4': '震度4',
  '5-': '震度5弱',
  '5+': '震度5強',
  '6-': '震度6弱',
  '6+': '震度6強',
  '7': '震度7',
};

function normalizeWolfxEqlist(o: Obj, test: boolean): EqlistReport | null {
  if (o.type === 'heartbeat') return null;
  const no1 = asObj(o.No1);
  const eventId = str(no1?.EventID);
  const originText = str(no1?.time_full);
  const originTime = parseJstTime(originText);
  if (!no1 || !eventId || originTime === null) return null;
  const shindo = typeof no1.shindo === 'string' ? no1.shindo : '';
  return {
    kind: 'eqlist',
    source: 'wolfx',
    eventId,
    originTime,
    observation: {
      source: 'wolfx',
      originTime: originText!,
      hypocenter: str(no1.location) ?? '',
      maebashiIntensity: null,
      maxIntensity: WOLFX_SHINDO_LABELS[shindo] ?? null,
    },
    belowFiveLower: /^[1-4]$/.test(shindo),
    training: test,
  };
}

/** 段階の判定に関係しない種類(555・heartbeat 等)と解釈できない形は null */
export function normalizeMessage(
  channel: ChannelName,
  raw: string,
  context: { readonly test: boolean },
): QuakeReport | null {
  const o = parseJson(raw);
  if (!o) return null;
  switch (channel) {
    case 'p2p':
      return normalizeP2p(o, context.test);
    case 'wolfxEew':
      return normalizeWolfxEew(o, context.test);
    case 'wolfxEqlist':
      return normalizeWolfxEqlist(o, context.test);
  }
}
