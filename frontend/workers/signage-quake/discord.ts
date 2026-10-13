import type { SignageQuakeStage } from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';
import type { QuakeNotice } from './relay-core';
import type { EewArea, EewReport, ObservationReport } from './upstream';

export interface WebhookBody {
  readonly content: string;
  readonly allowed_mentions: { readonly parse: readonly [] };
}

const CONTENT_LIMIT = 2000;
const UNKNOWN = '不明';
const FOOTER = '気象庁発表の転送・参考情報(公式の警報ではない)';
const TRAINING = '【訓練】';
const GUNMA_FIRST = '群馬県南部';

const STAGE_TEXT: Readonly<Record<SignageQuakeStage, string>> = {
  warning: '段階1(身を守る)',
  calm: '段階2(揺れは収まりました)',
  evacuate: '段階3(スタッフの指示待ち)',
  cancelled: '取消の表示',
};

const CHANNEL_NAMES: Readonly<Record<ChannelName, string>> = {
  p2p: 'P2P地震情報',
  wolfxEew: 'Wolfx緊急地震速報',
  wolfxEqlist: 'Wolfx地震情報',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** epoch ms を日本時間の `YYYY/MM/DD HH:mm:ss` にする */
function jst(ms: number): string {
  const d = new Date(ms + 9 * 3600_000);
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function quakeSummary(
  hypocenter: string | null,
  magnitude: number | null,
  depth: number | null,
): string {
  return `震源地: ${hypocenter ?? UNKNOWN} / M${magnitude ?? UNKNOWN} / 深さ${depth === null ? UNKNOWN : `${depth}km`}`;
}

const intensity = (s: string) => (s.startsWith('震度') ? s : `震度${s}`);

function intensityRange(from: string, to: string): string {
  if (to === '以上') return `${intensity(from)}以上`;
  if (from === to) return intensity(from);
  return `${intensity(from)}〜${intensity(to)}`;
}

const FIXED_ARRIVALS = ['既に到達と予測', '到達予想なし'];

function areaLine(a: EewArea): string {
  const arrival =
    a.arrival !== null && FIXED_ARRIVALS.includes(a.arrival)
      ? a.arrival
      : `到達予想時刻 ${a.arrival ?? UNKNOWN}`;
  return `・${a.name}: ${intensityRange(a.intensityFrom, a.intensityTo)}、${arrival}`;
}

const isGunma = (a: EewArea) => a.name.startsWith('群馬県');

/** 群馬県南部を先頭にし、残りは受信順 */
function orderAreas(areas: readonly EewArea[]): EewArea[] {
  return [
    ...areas.filter((a) => a.name === GUNMA_FIRST),
    ...areas.filter((a) => a.name !== GUNMA_FIRST),
  ];
}

function eewHeadline(r: EewReport): string {
  if (r.cancelled) return `【緊急地震速報(取消)】第${r.serial}報`;
  const suffix =
    r.detail.final === true ? '(最終報)' : r.serial >= 2 ? '(続報)' : '';
  return `【緊急地震速報(警報)】第${r.serial}報${suffix}`;
}

const sourceLine = (source: 'p2p' | 'wolfx', receivedAt: number) =>
  `情報源: ${source === 'p2p' ? 'P2P地震情報' : 'Wolfx'}(受信 ${jst(receivedAt)})`;

function join(training: boolean, lines: readonly string[]): string {
  return [...(training ? [TRAINING] : []), ...lines, FOOTER].join('\n');
}

/** 地域の行を後ろから省いて 2000 文字に収める。群馬県の地域は省かない */
function formatEew(r: EewReport, receivedAt: number): string {
  const head = [
    eewHeadline(r),
    quakeSummary(r.detail.hypocenter, r.detail.magnitude, r.detail.depth),
    `発生時刻: ${r.detail.originTimeText ?? UNKNOWN} / 発表時刻: ${r.detail.issuedAtText}`,
  ];
  const areas = orderAreas(r.detail.areas);
  const tail = [sourceLine(r.source, receivedAt)];
  const build = (shown: number): string => {
    const omitted = areas.length - shown;
    const body =
      areas.length === 0
        ? []
        : [
            '予想震度・到達予想時刻',
            ...areas.slice(0, shown).map(areaLine),
            ...(omitted > 0 ? [`・ほか${omitted}地域`] : []),
          ];
    return join(r.training, [...head, ...body, ...tail]);
  };
  const keep = areas.filter(isGunma).length;
  for (let shown = areas.length; shown >= keep; shown--) {
    const text = build(shown);
    if (text.length <= CONTENT_LIMIT) return text;
  }
  return build(keep).slice(0, CONTENT_LIMIT);
}

function formatObservation(r: ObservationReport, receivedAt: number): string {
  const maebashi = r.observation.maebashiIntensity;
  return join(r.training, [
    `【地震情報】${r.detail.issueType}`,
    quakeSummary(
      r.observation.hypocenter || null,
      r.detail.magnitude,
      r.detail.depth,
    ),
    `発生時刻: ${r.observation.originTime} / 発表時刻: ${r.detail.issuedAtText}`,
    maebashi === null
      ? '前橋市の観測点の発表なし'
      : `前橋市の震度: ${maebashi}`,
    sourceLine(r.source, receivedAt),
  ]);
}

function formatChannel(n: Extract<QuakeNotice, { kind: 'channel' }>): string {
  const name = CHANNEL_NAMES[n.channel];
  if (n.receiving)
    return join(false, [`【受信状態】${name}の受信を再開しました`]);
  const last = n.lastReceivedAt === null ? 'なし' : jst(n.lastReceivedAt);
  return join(false, [
    `【受信状態】${name}を受信できていません(最後の受信: ${last})`,
    ...(n.channel === 'p2p'
      ? ['前橋市の震度による段階3の判定ができません']
      : []),
  ]);
}

function formatContent(n: QuakeNotice): string {
  switch (n.kind) {
    case 'eew':
      return formatEew(n.report, n.receivedAt);
    case 'observation':
      return formatObservation(n.report, n.receivedAt);
    case 'stage':
      return n.payload.active
        ? join(n.payload.training, [
            n.payload.stage === 'cancelled'
              ? '【サイネージ】取消の表示にしました'
              : `【サイネージ】${STAGE_TEXT[n.payload.stage]}を表示しました`,
          ])
        : join(false, ['【サイネージ】速報の表示を終了しました']);
    case 'dismissed':
      return join(n.training, [
        `【サイネージ】速報の表示を解除しました(解除: ${n.by})`,
      ]);
    case 'channel':
      return formatChannel(n);
  }
}

/** 受信値は文字列・コードの表示名だけを使い、計算しない */
export function formatNotice(notice: QuakeNotice): WebhookBody {
  return {
    content: formatContent(notice),
    // 受信した文字列でメンションを起こさない
    allowed_mentions: { parse: [] },
  };
}
