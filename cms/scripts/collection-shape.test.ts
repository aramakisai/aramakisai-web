import { describe, expect, it } from 'vitest';

import {
  detectBreakingChanges,
  toShape,
  type EntityShape,
} from './collection-shape';

const base: EntityShape[] = [
  {
    slug: 'announcements',
    fields: [
      { name: 'title', type: 'text', required: true, hasMany: false },
      { name: 'published_at', type: 'date', required: false, hasMany: false },
      { name: 'attachments', type: 'upload', required: false, hasMany: true },
    ],
  },
];

function head(fields: EntityShape['fields']): EntityShape[] {
  return [{ slug: 'announcements', fields }];
}

describe('detectBreakingChanges', () => {
  it('変更がなければ何も検出しない', () => {
    expect(detectBreakingChanges(base, base)).toEqual([]);
  });

  it('フィールド追加は破壊的とみなさない', () => {
    const changes = detectBreakingChanges(
      base,
      head([
        ...base[0].fields,
        { name: 'summary', type: 'text', required: false, hasMany: false },
      ]),
    );
    expect(changes).toEqual([]);
  });

  it('フィールド削除を検出する', () => {
    const changes = detectBreakingChanges(
      base,
      head(base[0].fields.filter((f) => f.name !== 'published_at')),
    );
    expect(changes).toEqual([
      { kind: 'field_removed', slug: 'announcements', field: 'published_at' },
    ]);
  });

  it('型変更を検出する', () => {
    const changes = detectBreakingChanges(
      base,
      head(
        base[0].fields.map((f) =>
          f.name === 'published_at' ? { ...f, type: 'text' } : f,
        ),
      ),
    );
    expect(changes).toEqual([
      {
        kind: 'type_changed',
        slug: 'announcements',
        field: 'published_at',
        from: 'date',
        to: 'text',
      },
    ]);
  });

  it('必須化を検出する', () => {
    const changes = detectBreakingChanges(
      base,
      head(
        base[0].fields.map((f) =>
          f.name === 'published_at' ? { ...f, required: true } : f,
        ),
      ),
    );
    expect(changes).toEqual([
      { kind: 'field_required', slug: 'announcements', field: 'published_at' },
    ]);
  });

  it('必須の解除は破壊的とみなさない', () => {
    const changes = detectBreakingChanges(
      base,
      head(
        base[0].fields.map((f) => (f.name === 'title' ? { ...f, required: false } : f)),
      ),
    );
    expect(changes).toEqual([]);
  });

  it('多重度の変更を検出する', () => {
    const changes = detectBreakingChanges(
      base,
      head(
        base[0].fields.map((f) =>
          f.name === 'attachments' ? { ...f, hasMany: false } : f,
        ),
      ),
    );
    expect(changes).toEqual([
      { kind: 'has_many_changed', slug: 'announcements', field: 'attachments' },
    ]);
  });

  it('コレクションごと削除されたことを検出する', () => {
    expect(detectBreakingChanges(base, [])).toEqual([
      { kind: 'entity_removed', slug: 'announcements' },
    ]);
  });

  it('同じ入力に対して同じ結果を返す', () => {
    const once = detectBreakingChanges(base, []);
    const twice = detectBreakingChanges(base, []);
    expect(once).toEqual(twice);
  });
});

describe('toShape', () => {
  it('コレクション定義から名前付きフィールドだけを取り出す', () => {
    const shape = toShape({
      slug: 'topics',
      fields: [
        { name: 'title', type: 'text', required: true },
        { type: 'row', fields: [] },
      ],
    } as never);

    expect(shape).toEqual({
      slug: 'topics',
      fields: [{ name: 'title', type: 'text', required: true, hasMany: false }],
    });
  });
});
