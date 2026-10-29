import type { SignageTelopItem } from './signage';
import { stagesWithPerformances, type Timetable } from './timetable';

export const STAGE_NOTICE_LEAD_MS = 3 * 60 * 1000;

export interface StageStartNotice {
  readonly performanceId: number;
  /** TimetablePerformance.name */
  readonly name: string;
  readonly stageName: string;
  /** STAGE_BAND_CLASSES の添字。いまのステージ(stageNow)と同じ stagesWithPerformances の割り当て */
  readonly colorIndex: number;
  /** ISO。TimetablePerformance.slot.startAt */
  readonly startAt: string;
}

export function stageStartNotices(
  timetable: Timetable,
  now: Date,
): readonly StageStartNotice[] {
  const t = now.getTime();
  // startAt が絶対時刻なので開催日では絞らない(日またぎの開始も同じ判定で拾う)
  const due = timetable.performances.filter((p) => {
    const start = Date.parse(p.slot.startAt);
    return (
      p.name.trim() !== '' && start - STAGE_NOTICE_LEAD_MS <= t && t < start
    );
  });
  return stagesWithPerformances(timetable.stages, due).flatMap(
    ({ stage, colorIndex }) =>
      due
        .filter((p) => p.stageId === stage.id)
        .sort((a, b) => Date.parse(a.slot.startAt) - Date.parse(b.slot.startAt))
        .map((p) => ({
          performanceId: p.id,
          name: p.name,
          stageName: stage.name,
          colorIndex,
          startAt: p.slot.startAt,
        })),
  );
}

export function noticeTelops(
  notices: readonly StageStartNotice[],
): readonly SignageTelopItem[] {
  return notices.map((n) => ({
    id: -n.performanceId,
    audience: 'visitor',
    target: n.stageName,
    body: `まもなく${n.name}が始まります`,
  }));
}
