'use client';

import { SelectInput, useField } from '@payloadcms/ui';
import type { DateFieldClientComponent } from 'payload';

import { buildEventDayOptions, eventDayValue } from './event-day-options';
import { useEventDays } from './useEventDays';

const EventDaySelect: DateFieldClientComponent = ({ path, field }) => {
  const { value, setValue, showError } = useField<string>({ path });
  const days = useEventDays();

  if (days && days.length === 0) {
    return <p>祭基本情報で開催日程を登録してください</p>;
  }

  return (
    <SelectInput
      name={path}
      path={path}
      label={field.label}
      required
      showError={showError}
      isClearable={false}
      options={days ? buildEventDayOptions(days, value) : []}
      value={eventDayValue(value) ?? undefined}
      onChange={(option) => {
        const picked = Array.isArray(option) ? option[0] : option;
        setValue(picked ? String((picked as { value: unknown }).value) : null);
      }}
    />
  );
};

export default EventDaySelect;
