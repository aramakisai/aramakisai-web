import type {
  SignageQuakeObservation,
  SignageQuakePayload,
  SignageQuakeStage,
} from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';
import type { EewReport, ObservationReport, QuakeReport } from './upstream';

export interface EewKey {
  readonly eventId: string;
  readonly serial: number;
  readonly cancelled: boolean;
}

export type QuakeNotice =
  | {
      readonly kind: 'eew';
      readonly op: 'post' | 'edit';
      readonly report: EewReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'observation';
      readonly report: ObservationReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'stage';
      readonly payload: SignageQuakePayload;
      readonly at: number;
    }
  | {
      readonly kind: 'dismissed';
      readonly by: string;
      readonly training: boolean;
      readonly at: number;
    }
  | {
      readonly kind: 'channel';
      readonly channel: ChannelName;
      readonly receiving: boolean;
      readonly lastReceivedAt: number | null;
      readonly at: number;
    };

export const EEW_FRESH_MS = 120_000;
export const OBSERVATION_FRESH_MS = 600_000;
export const EQLIST_FRESH_MS = 1_200_000;
export const EEW_RECORD_LIMIT = 50;

/** 地震ごとに、最も新しい報と、その報のDiscordの投稿を1件だけ持つ */
export interface EewRecord extends EewKey {
  readonly source: 'p2p' | 'wolfx';
  /** 群馬県を含む警報(または試験モードの報)を投稿した地震。続報・取消の投稿の可否 */
  readonly notify: boolean;
  /** この報の投稿のメッセージID。未投稿・投稿の失敗は null */
  readonly discordMessageId: string | null;
}

export type Precedence = 'new' | 'replace' | 'drop';

/** 選別。test(試験モードの系統)の報は鮮度を問わない。群馬県の判定は processReport で行う */
export function acceptReport(
  report: QuakeReport,
  now: number,
  test: boolean,
): boolean {
  switch (report.kind) {
    case 'eew':
      return (
        (report.warning || report.cancelled) &&
        (test || now - report.issuedAt <= EEW_FRESH_MS)
      );
    case 'observation':
      return (
        report.hasStations &&
        (test || now - report.issuedAt <= OBSERVATION_FRESH_MS)
      );
    case 'eqlist':
      return test || now - report.originTime <= EQLIST_FRESH_MS;
  }
}

/** 順位は(続報番号, 取消か)の辞書順。続報番号が新しい報は系統に依らず優先する */
export function eewPrecedence(
  record: EewRecord | undefined,
  report: EewReport,
): Precedence {
  if (!record) return 'new';
  const diff =
    report.serial - record.serial ||
    Number(report.cancelled) - Number(record.cancelled);
  if (diff > 0) return 'new';
  if (diff < 0) return 'drop';
  return record.source === 'wolfx' && report.source === 'p2p'
    ? 'replace'
    : 'drop';
}

/** 同じ地震の記録は置き換え、末尾が最新。上限を超えたら古いものから捨てる */
export function putRecord(
  records: readonly EewRecord[],
  record: EewRecord,
): readonly EewRecord[] {
  return [...records.filter((r) => r.eventId !== record.eventId), record].slice(
    -EEW_RECORD_LIMIT,
  );
}
