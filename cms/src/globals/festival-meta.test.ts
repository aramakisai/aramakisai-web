import { describe, expect, it } from 'vitest';

import { FestivalMeta } from './festival-meta';

type NamedField = { name: string; [key: string]: unknown };

const fieldOf = (fields: readonly unknown[], name: string): NamedField =>
  fields.find((f): f is NamedField => (f as NamedField).name === name) as NamedField;

const eventDays = fieldOf(FestivalMeta.fields, 'event_days');

describe('event_days フィールド', () => {
  it('配列型である', () => {
    expect(eventDays.type).toBe('array');
  });

  it('開場日時・終了日時が必須の日時、表示ラベルは任意のテキストである', () => {
    const startAt = fieldOf(eventDays.fields as unknown[], 'start_at');
    const endAt = fieldOf(eventDays.fields as unknown[], 'end_at');
    const label = fieldOf(eventDays.fields as unknown[], 'label');

    expect(startAt.type).toBe('date');
    expect(startAt.required).toBe(true);
    expect(endAt.type).toBe('date');
    expect(endAt.required).toBe(true);

    expect(label.type).toBe('text');
    expect(label.required).toBeFalsy();
  });
});
