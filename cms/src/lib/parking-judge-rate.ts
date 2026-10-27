export type ModelId = 'gemma-4-26b-a4b-it' | 'gemma-4-31b-it' | 'gemini-3.1-flash-lite';

export interface ModelLimit {
  readonly rpm: number;
  readonly rpd: number;
}

export interface ParkingJudgeRate {
  /** 枠があれば1回分を確保してtrue */
  tryAcquire(model: ModelId, now: Date): boolean;
  /** 429を受けたモデルをuntilまで使わない */
  coolDown(model: ModelId, until: Date): void;
}

export const MODEL_LIMITS: Readonly<Record<ModelId, ModelLimit>> = {
  'gemma-4-26b-a4b-it': { rpm: 30, rpd: 14_400 },
  'gemma-4-31b-it': { rpm: 30, rpd: 14_400 },
  'gemini-3.1-flash-lite': { rpm: 15, rpd: 500 },
};

// Gemini の日次クォータは太平洋時間の 0 時に戻る。en-CA は YYYY-MM-DD で出る
const pacificDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);

interface State {
  recent: number[];
  day: string;
  dayCount: number;
  coolUntil: number;
}

// 判定は cms-worker の 1 プロセスだけが実行するため、メモリだけで全カメラ分を数えられる
export function createParkingJudgeRate(): ParkingJudgeRate {
  const states = new Map<ModelId, State>();
  const stateOf = (model: ModelId): State => {
    let s = states.get(model);
    if (!s) {
      s = { recent: [], day: '', dayCount: 0, coolUntil: 0 };
      states.set(model, s);
    }
    return s;
  };

  return {
    tryAcquire(model, now) {
      const s = stateOf(model);
      const limit = MODEL_LIMITS[model];
      const t = now.getTime();
      if (t < s.coolUntil) return false;
      const day = pacificDay(now);
      if (s.day !== day) {
        s.day = day;
        s.dayCount = 0;
      }
      s.recent = s.recent.filter((x) => t - x < 60_000);
      if (s.recent.length >= limit.rpm || s.dayCount >= limit.rpd) return false;
      s.recent.push(t);
      s.dayCount += 1;
      return true;
    },
    coolDown(model, until) {
      stateOf(model).coolUntil = until.getTime();
    },
  };
}
