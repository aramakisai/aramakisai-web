'use client';

import { FieldError, FieldLabel, useAuth, useField } from '@payloadcms/ui';
import type { TextFieldClientComponent } from 'payload';

import { buildEventDayCheckOptions, eventDayValue } from './event-day-options';
import { useEventDays } from './useEventDays';

const EventDayCheckboxes: TextFieldClientComponent = ({ path, field }) => {
  const { value, setValue, showError, errorMessage } = useField<string[]>({ path });
  const days = useEventDays();
  const { user } = useAuth();
  // 必須チェックは学生団体ロールにだけ課すため、field.required ではなくロールで決める
  const required = (user as { role?: string } | null)?.role === 'student_exhibitor';

  if (!days) return null;
  if (days.length === 0) return <p>祭基本情報で開催日程を登録してください</p>;

  const selected = new Set((value ?? []).flatMap((v) => eventDayValue(v) ?? []));
  const options = buildEventDayCheckOptions(days, value ?? []);

  return (
    <div className="field-type">
      <FieldLabel label={field.label} path={path} required={required} />
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
      <FieldError path={path} showError={showError} message={errorMessage} />
    </div>
  );
};

export default EventDayCheckboxes;
