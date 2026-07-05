import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseSnapshot } from './check-additive-schema';

const REAL_SNAPSHOT_PATH = path.resolve(
  __dirname,
  '../../directus/schema/snapshot.yaml',
);

describe('parseSnapshot', () => {
  it('parses the real repository snapshot.yaml without throwing, matching raw collection/field counts', () => {
    const yamlText = readFileSync(REAL_SNAPSHOT_PATH, 'utf-8');
    const raw = parseYaml(yamlText) as {
      collections: Array<{ collection: string }>;
      fields: Array<{ collection: string; field: string }>;
    };

    const result = parseSnapshot(yamlText);

    expect(result.collections).toHaveLength(raw.collections.length);
    expect(result.fields).toHaveLength(raw.fields.length);
  });

  it('extracts type/data_type/is_nullable for a field with schema information present', () => {
    const yamlText = `
collections:
  - collection: announcements
    meta:
      note: something
fields:
  - collection: announcements
    field: title
    type: string
    meta:
      note: null
    schema:
      data_type: character varying
      is_nullable: false
`;

    const result = parseSnapshot(yamlText);

    expect(result.collections).toEqual(['announcements']);
    expect(result.fields).toEqual([
      {
        collection: 'announcements',
        field: 'title',
        type: 'string',
        schema: { data_type: 'character varying', is_nullable: false },
      },
    ]);
  });

  it('does not throw for a field whose schema is null (alias/relational field with no physical column)', () => {
    const yamlText = `
collections:
  - collection: announcements
    meta:
      note: something
fields:
  - collection: announcements
    field: related_items
    type: alias
    meta:
      special: [o2m]
    schema: null
`;

    const result = parseSnapshot(yamlText);

    expect(result.fields).toEqual([
      {
        collection: 'announcements',
        field: 'related_items',
        type: 'alias',
        schema: null,
      },
    ]);
  });

  it('deduplicates collection names and keeps fields in source order', () => {
    const yamlText = `
collections:
  - collection: a
    meta:
      note: x
fields:
  - collection: a
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: a
    field: name
    type: string
    schema:
      data_type: character varying
      is_nullable: true
`;

    const result = parseSnapshot(yamlText);

    expect(result.collections).toEqual(['a']);
    expect(result.fields.map((f) => f.field)).toEqual(['id', 'name']);
  });
});
