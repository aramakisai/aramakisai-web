'use client';

import { FieldLabel, useField } from '@payloadcms/ui';
import type { DateFieldClientComponent } from 'payload';

import { buildEventDayOptions, eventDayValue } from './event-day-options';
import { useEventDays } from './useEventDays';

const EventDaySelect: DateFieldClientComponent = ({ path, field }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path });
  const days = useEventDays();
  const options = days ? buildEventDayOptions(days, value) : [];

  return (
    <div className="field-type">
      <FieldLabel path={path} label={field.label} required />
      {days && days.length === 0 ? (
        <p>祭基本情報で開催日程を登録してください</p>
      ) : (
        <select
          id={`field-${path}`}
          className="select-input"
          style={{ width: '100%', padding: '0.5rem' }}
          value={eventDayValue(value) ?? ''}
          onChange={(e) => setValue(e.target.value || null)}
        >
          <option value="">選択してください</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {showError && <p style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</p>}
    </div>
  );
};

export default EventDaySelect;
