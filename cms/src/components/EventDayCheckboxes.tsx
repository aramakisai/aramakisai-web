'use client';

import { FieldLabel, useField } from '@payloadcms/ui';
import type { TextFieldClientComponent } from 'payload';

import { buildEventDayCheckOptions, eventDayValue } from './event-day-options';
import { useEventDays } from './useEventDays';

const EventDayCheckboxes: TextFieldClientComponent = ({ path, field }) => {
  const { value, setValue } = useField<string[]>({ path });
  const days = useEventDays();

  if (!days) return null;
  if (days.length === 0) return <p>祭基本情報で開催日程を登録してください</p>;

  const selected = new Set((value ?? []).flatMap((v) => eventDayValue(v) ?? []));
  const options = buildEventDayCheckOptions(days, value ?? []);

  return (
    <div className="field-type">
      <FieldLabel label={field.label} path={path} />
      {options.map((o) => (
        <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={selected.has(o.value)}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(o.value);
              else next.delete(o.value);
              setValue([...next].sort());
            }}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
};

export default EventDayCheckboxes;
