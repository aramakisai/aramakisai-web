import type { SignageQuakeStage } from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';
import type { EewKey, QuakeNotice } from './relay-core';
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

export interface DiscordStatus {
  readonly configured: boolean;
  /** 401・403・404を受けて、再起動まで投稿を止めている */
  readonly disabled: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  /** 'http_429'・'http_500'・'network'・'timeout'等。URLは含めない */
  readonly lastFailure: string | null;
}

export interface DiscordQueueDeps {
  readonly webhookUrl: string | null;
  readonly fetch: typeof fetch;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  /** 編集の直前に、その報の記録のメッセージIDを読む。記録が別の報に進んでいればundefined */
  readonly messageIdFor: (key: EewKey) => string | null | undefined;
  /** 投稿の応答のメッセージIDを保存する */
  readonly saveMessageId: (key: EewKey, messageId: string) => Promise<void>;
}

const QUEUE_LIMIT = 100;
const MAX_ATTEMPTS = 3;
const RETRY_WAITS_MS = [2000, 5000];
const MAX_RATE_LIMIT_WAIT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

const keyOf = (n: QuakeNotice): EewKey | null =>
  n.kind === 'eew'
    ? {
        eventId: n.report.eventId,
        serial: n.report.serial,
        cancelled: n.report.cancelled,
      }
    : null;

/** 実行委員用チャンネルのWebhookへ1件ずつ投稿・編集する。呼び出し側を待たせない */
export class DiscordQueue {
  readonly #deps: DiscordQueueDeps;
  readonly #queue: QuakeNotice[] = [];
  #running = false;
  #disabled = false;
  /** 応答のヘッダが示す、次の要求を送ってよい時刻 */
  #notBefore = 0;
  #lastSuccessAt: string | null = null;
  #lastFailureAt: string | null = null;
  #lastFailure: string | null = null;

  constructor(deps: DiscordQueueDeps) {
    this.#deps = deps;
  }

  /** 待ち行列に足すだけで待たない */
  enqueue(notice: QuakeNotice): void {
    if (this.#deps.webhookUrl === null || this.#disabled) return;
    if (this.#queue.length >= QUEUE_LIMIT) {
      console.warn(`discord queue full: dropped ${notice.kind}`);
      return;
    }
    this.#queue.push(notice);
    if (!this.#running) void this.#drain();
  }

  status(): DiscordStatus {
    return {
      configured: this.#deps.webhookUrl !== null,
      disabled: this.#disabled,
      lastSuccessAt: this.#lastSuccessAt,
      lastFailureAt: this.#lastFailureAt,
      lastFailure: this.#lastFailure,
    };
  }

  async #drain(): Promise<void> {
    this.#running = true;
    try {
      while (this.#queue.length > 0 && !this.#disabled) {
        const notice = this.#queue.shift()!;
        try {
          await this.#deliver(notice);
        } catch {
          this.#fail(notice.kind, 'internal');
        }
      }
    } finally {
      this.#running = false;
    }
  }

  async #deliver(notice: QuakeNotice): Promise<void> {
    const base = this.#deps.webhookUrl!;
    const key = keyOf(notice);
    let method = 'POST';
    let url = `${base}?wait=true`;
    if (notice.kind === 'eew' && notice.op === 'edit' && key) {
      const id = this.#deps.messageIdFor(key);
      if (id === undefined) return;
      if (id !== null) {
        method = 'PATCH';
        url = `${base}/messages/${id}`;
      }
    }
    const res = await this.#send(
      method,
      url,
      JSON.stringify(formatNotice(notice)),
      notice.kind,
    );
    if (!res || method !== 'POST' || !key) return;
    const body: unknown = await res.json().catch(() => null);
    const id = (body as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') return;
    await this.#deps.saveMessageId(key, id).catch(() => {
      console.warn('discord message id not saved');
    });
  }

  async #send(
    method: string,
    url: string,
    body: string,
    kind: string,
  ): Promise<Response | null> {
    const { sleep, now } = this.#deps;
    for (let attempt = 1; ; attempt++) {
      const wait = this.#notBefore - now();
      if (wait > 0) await sleep(wait);

      let res: Response;
      try {
        res = await this.#deps.fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (e) {
        const timedOut =
          e instanceof Error &&
          (e.name === 'TimeoutError' || e.name === 'AbortError');
        if (attempt >= MAX_ATTEMPTS)
          return this.#fail(kind, timedOut ? 'timeout' : 'network');
        await sleep(RETRY_WAITS_MS[attempt - 1]!);
        continue;
      }

      if (res.ok) {
        this.#noteRateLimit(res);
        this.#lastSuccessAt = new Date(now()).toISOString();
        return res;
      }
      if (res.status === 429) {
        const waitMs = await retryAfterMs(res);
        if (waitMs > MAX_RATE_LIMIT_WAIT_MS || attempt >= MAX_ATTEMPTS)
          return this.#fail(kind, 'http_429');
        await sleep(waitMs);
        continue;
      }
      this.#noteRateLimit(res);
      if (res.status >= 500) {
        if (attempt >= MAX_ATTEMPTS)
          return this.#fail(kind, `http_${res.status}`);
        await sleep(RETRY_WAITS_MS[attempt - 1]!);
        continue;
      }
      // 無効な要求を重ねるとIPごと制限されるため、Webhookが使えないときは再起動まで止める
      if ([401, 403, 404].includes(res.status)) {
        this.#disabled = true;
        this.#queue.length = 0;
      }
      return this.#fail(kind, `http_${res.status}`);
    }
  }

  #noteRateLimit(res: Response): void {
    if (res.headers.get('x-ratelimit-remaining') !== '0') return;
    const after = Number(res.headers.get('x-ratelimit-reset-after'));
    if (Number.isFinite(after) && after > 0)
      this.#notBefore = this.#deps.now() + after * 1000;
  }

  /** URL・本文は出さない */
  #fail(kind: string, failure: string): null {
    this.#lastFailureAt = new Date(this.#deps.now()).toISOString();
    this.#lastFailure = failure;
    console.warn(`discord ${kind} failed: ${failure}`);
    return null;
  }
}

/** 本文のretry_after(秒、小数)、無ければRetry-Afterヘッダ(秒)。どちらも無ければ1秒 */
async function retryAfterMs(res: Response): Promise<number> {
  const body: unknown = await res.json().catch(() => null);
  const fromBody = (body as { retry_after?: unknown } | null)?.retry_after;
  const secs =
    typeof fromBody === 'number'
      ? fromBody
      : Number(res.headers.get('retry-after'));
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : 1000;
}
