'use client';

import type { DefaultCellComponentProps } from 'payload';

import { eventDayLabel } from './event-day-options';
import { useEventDays } from './useEventDays';

export default function EventDayCell({ cellData }: DefaultCellComponentProps) {
  const days = useEventDays();
  return <span>{days ? eventDayLabel(days, cellData) : ''}</span>;
}
