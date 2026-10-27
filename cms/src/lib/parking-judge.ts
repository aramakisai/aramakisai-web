import type { ImageQuality } from './parking-exposure';
import type { ModelId, ParkingJudgeRate } from './parking-judge-rate';

export type { ModelId } from './parking-judge-rate';

export type Congestion = 'available' | 'crowded' | 'full';
export type JudgeMode = 'congestion_and_quality' | 'quality_only';

export type JudgeOutcome =
  | {
      readonly kind: 'judged';
      readonly model: ModelId;
      /** unknownは判定失敗として扱う。写り具合だけを判定したときはnull */
      readonly congestion: Congestion | 'unknown' | null;
      /** 4種のどれでもなければnull */
      readonly quality: ImageQuality | null;
    }
  | { readonly kind: 'failed'; readonly detail: string }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'superseded' };

export interface JudgeDeps {
  readonly apiKey: string;
  readonly rate: ParkingJudgeRate;
  readonly fetchImpl: typeof fetch;
  readonly sleep: (ms: number) => Promise<void>;
  /** 呼び直しの前に、対象の画像がまだ最新かを確かめる */
  readonly isCurrent: () => Promise<boolean>;
}

export const MODELS: readonly ModelId[] = ['gemma-4-26b-a4b-it', 'gemma-4-31b-it', 'gemini-3.1-flash-lite'];

const CONGESTIONS = ['available', 'crowded', 'full', 'unknown'] as const;
const QUALITIES = ['ok', 'too_dark', 'too_bright', 'color_cast'] as const;
const CALL_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const COOL_DOWN_MS = 60_000;

const QUALITY_PROMPT = `image_quality: how viewable the image is for website visitors, independent of congestion.
- ok: natural colors and brightness. too_dark / too_bright: exposure problem. color_cast: strong overall tint (e.g. cyan, green, magenta).`;

export const PROMPTS: Record<JudgeMode, string> = {
  congestion_and_quality: `You judge an image from a fixed camera overlooking a parking lot.
congestion: estimate the occupancy rate of regular parking spaces visible in the image.
- Ignore spaces in designated areas (car-sharing, accessible, loading, hatched zones, cones) and cars parked outside marked spaces.
- full: occupancy 90% or more. crowded: 70% to under 90%. available: under 70%.
- unknown: no parking lot is visible, or the image is too degraded to estimate.
${QUALITY_PROMPT}`,
  quality_only: `You judge an image from a fixed camera.
${QUALITY_PROMPT}`,
};

const QUALITY_SCHEMA = {
  type: 'STRING',
  enum: [...QUALITIES],
  description: 'How viewable the image is for website visitors, independent of congestion.',
};

export const RESPONSE_SCHEMAS: Record<JudgeMode, object> = {
  congestion_and_quality: {
    type: 'OBJECT',
    properties: {
      congestion: {
        type: 'STRING',
        enum: [...CONGESTIONS],
        description: 'Parking lot occupancy. unknown if no parking lot is visible or cannot judge.',
      },
      image_quality: QUALITY_SCHEMA,
    },
    required: ['congestion', 'image_quality'],
  },
  quality_only: {
    type: 'OBJECT',
    properties: { image_quality: QUALITY_SCHEMA },
    required: ['image_quality'],
  },
};

type Parsed = { congestion: Congestion | 'unknown' | null; quality: ImageQuality | null };
type Attempt = { ok: true; parsed: Parsed } | { ok: false; code: string; retry: boolean };

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  list.find((x) => x === v) ?? null;

function parseBody(body: unknown, mode: JudgeMode): Parsed | null {
  const text = (body as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0]
    ?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return null;
  let json: { congestion?: unknown; image_quality?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (json === null || typeof json !== 'object') return null;
  const quality = oneOf(QUALITIES, json.image_quality);
  if (mode === 'quality_only') return quality ? { congestion: null, quality } : null;
  const congestion = oneOf(CONGESTIONS, json.congestion);
  return congestion ? { congestion, quality } : null;
}

async function callOnce(model: ModelId, jpeg: Buffer, mode: JudgeMode, deps: JudgeDeps): Promise<Attempt> {
  let res: Response;
  try {
    res = await deps.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': deps.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPTS[mode] }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Judge this image.' }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMAS[mode] },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return { ok: false, code: timedOut ? 'timeout' : 'network', retry: true };
  }
  if (res.status === 429) return { ok: false, code: '429', retry: false };
  if (res.status === 500 || res.status === 503) return { ok: false, code: String(res.status), retry: true };
  if (!res.ok) return { ok: false, code: String(res.status), retry: false };
  const parsed = parseBody(await res.json().catch(() => null), mode);
  return parsed ? { ok: true, parsed } : { ok: false, code: 'invalid_response', retry: true };
}

export async function judgeImage(jpeg: Buffer, mode: JudgeMode, deps: JudgeDeps): Promise<JudgeOutcome> {
  const summary: string[] = [];

  for (const model of MODELS) {
    let last: { code: string; count: number } | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (!deps.rate.tryAcquire(model, new Date())) break;
      const result = await callOnce(model, jpeg, mode, deps);
      if (result.ok) return { kind: 'judged', model, ...result.parsed };

      last = { code: result.code, count: attempt };
      if (result.code === '429') deps.rate.coolDown(model, new Date(Date.now() + COOL_DOWN_MS));
      if (!result.retry || attempt === MAX_ATTEMPTS) break;
      if (!(await deps.isCurrent())) return { kind: 'superseded' };
      await deps.sleep(2000 * 2 ** (attempt - 1));
    }

    if (last) summary.push(`${model} ${last.code}x${last.count}`);
  }

  return summary.length === 0 ? { kind: 'rate_limited' } : { kind: 'failed', detail: summary.join(', ') };
}
