import { TouchTimetable } from '@/components/signage/touch/touch-timetable';
import { loadForIsr } from '@/lib/isr';
import {
  getTimetable,
  resolveInitialDayKey,
  type Timetable,
} from '@/lib/timetable';

export const revalidate = 60;

const EMPTY_TIMETABLE: Timetable = { days: [], stages: [], performances: [] };

export default async function TouchTimetablePage() {
  const timetable = await loadForIsr(getTimetable, EMPTY_TIMETABLE);
  const renderedAt = new Date().toISOString();
  return (
    <TouchTimetable
      timetable={timetable}
      initialDayKey={resolveInitialDayKey(timetable.days, new Date(renderedAt))}
      renderedAt={renderedAt}
    />
  );
}
