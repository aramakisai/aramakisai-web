import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  parseSnapshot,
  diffSchemas,
  formatSummary,
  runChecker,
  type ParsedSnapshot,
  type SchemaDiffResult,
} from './check-additive-schema';

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

describe('diffSchemas', () => {
  const snapshot = (
    collections: string[],
    fields: ParsedSnapshot['fields'],
  ): ParsedSnapshot => ({ collections, fields });

  it('detects a deleted collection', () => {
    const base = snapshot(['announcements', 'events'], []);
    const head = snapshot(['announcements'], []);

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([
      {
        kind: 'collection-deleted',
        collection: 'events',
        detail: expect.any(String),
      },
    ]);
    expect(result.isAdditiveOnly).toBe(false);
  });

  it('detects a deleted field within a still-existing collection', () => {
    const base = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'title',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
      ],
    );
    const head = snapshot(['announcements'], []);

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([
      {
        kind: 'field-deleted',
        collection: 'announcements',
        field: 'title',
        detail: expect.any(String),
      },
    ]);
    expect(result.isAdditiveOnly).toBe(false);
  });

  it('does not double-report fields under a deleted collection as field-deleted', () => {
    const base = snapshot(
      ['events'],
      [
        {
          collection: 'events',
          field: 'name',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
      ],
    );
    const head = snapshot([], []);

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([
      { kind: 'collection-deleted', collection: 'events', detail: expect.any(String) },
    ]);
  });

  it('detects a type/data_type change on an unchanged field', () => {
    const base = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'priority',
          type: 'integer',
          schema: { data_type: 'integer', is_nullable: true },
        },
      ],
    );
    const head = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'priority',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
      ],
    );

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([
      {
        kind: 'type-changed',
        collection: 'announcements',
        field: 'priority',
        detail: expect.any(String),
      },
    ]);
    expect(result.isAdditiveOnly).toBe(false);
  });

  it('detects is_nullable true -> false (NOT NULL 化) but not the reverse', () => {
    const makeField = (is_nullable: boolean) => ({
      collection: 'announcements',
      field: 'body',
      type: 'text',
      schema: { data_type: 'text', is_nullable },
    });

    const notNullAdded = diffSchemas(
      snapshot(['announcements'], [makeField(true)]),
      snapshot(['announcements'], [makeField(false)]),
    );
    expect(notNullAdded.breakingChanges).toEqual([
      {
        kind: 'not-null-added',
        collection: 'announcements',
        field: 'body',
        detail: expect.any(String),
      },
    ]);

    const nullableRelaxed = diffSchemas(
      snapshot(['announcements'], [makeField(false)]),
      snapshot(['announcements'], [makeField(true)]),
    );
    expect(nullableRelaxed.breakingChanges).toEqual([]);
    expect(nullableRelaxed.isAdditiveOnly).toBe(true);
  });

  it('excludes fields with a null schema on either side from type/not-null checks', () => {
    const base = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'related_items',
          type: 'alias',
          schema: null,
        },
      ],
    );
    const head = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'related_items',
          type: 'alias',
          schema: null,
        },
      ],
    );

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([]);
    expect(result.isAdditiveOnly).toBe(true);
  });

  it('treats new collections/fields as additive-only (isAdditiveOnly: true)', () => {
    const base = snapshot(['announcements'], []);
    const head = snapshot(
      ['announcements', 'sponsors'],
      [
        {
          collection: 'announcements',
          field: 'new_field',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
      ],
    );

    const result = diffSchemas(base, head);

    expect(result.breakingChanges).toEqual([]);
    expect(result.isAdditiveOnly).toBe(true);
  });

  it('covers every breaking-change kind together while ignoring additive-only noise', () => {
    const base = snapshot(
      ['announcements', 'events'],
      [
        {
          collection: 'announcements',
          field: 'title',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'legacy_note',
          type: 'text',
          schema: { data_type: 'text', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'priority',
          type: 'integer',
          schema: { data_type: 'integer', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'body',
          type: 'text',
          schema: { data_type: 'text', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'optional_flag',
          type: 'boolean',
          schema: { data_type: 'boolean', is_nullable: false },
        },
      ],
    );
    const head = snapshot(
      ['announcements'],
      [
        {
          collection: 'announcements',
          field: 'title',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'priority',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'body',
          type: 'text',
          schema: { data_type: 'text', is_nullable: false },
        },
        {
          collection: 'announcements',
          field: 'optional_flag',
          type: 'boolean',
          schema: { data_type: 'boolean', is_nullable: true },
        },
        {
          collection: 'announcements',
          field: 'new_field',
          type: 'string',
          schema: { data_type: 'character varying', is_nullable: true },
        },
      ],
    );

    const result = diffSchemas(base, head);
    const kinds = result.breakingChanges.map((c) => `${c.kind}:${c.collection}:${c.field ?? ''}`);

    expect(kinds).toEqual(
      expect.arrayContaining([
        'collection-deleted:events:',
        'field-deleted:announcements:legacy_note',
        'type-changed:announcements:priority',
        'not-null-added:announcements:body',
      ]),
    );
    expect(result.breakingChanges).toHaveLength(4);
    expect(result.isAdditiveOnly).toBe(false);
  });
});

describe('formatSummary', () => {
  it('returns an additive-only summary and exit code 0 when there are no breaking changes', () => {
    const result: SchemaDiffResult = { breakingChanges: [], isAdditiveOnly: true };

    const report = formatSummary(result);

    expect(report.exitCode).toBe(0);
    expect(report.summary).toMatch(/additive/i);
    expect(report.summary).not.toContain('|');
  });

  it('returns a Markdown table listing every breaking change and exit code 1', () => {
    const result: SchemaDiffResult = {
      breakingChanges: [
        {
          kind: 'collection-deleted',
          collection: 'events',
          detail: 'collection "events" was removed',
        },
        {
          kind: 'field-deleted',
          collection: 'announcements',
          field: 'legacy_note',
          detail: 'field "legacy_note" was removed from collection "announcements"',
        },
        {
          kind: 'type-changed',
          collection: 'announcements',
          field: 'priority',
          detail: 'type changed from "integer" to "string"',
        },
        {
          kind: 'not-null-added',
          collection: 'announcements',
          field: 'body',
          detail: 'field "body" changed from nullable to NOT NULL',
        },
      ],
      isAdditiveOnly: false,
    };

    const report = formatSummary(result);

    expect(report.exitCode).toBe(1);
    expect(report.summary).toContain('| Collection | Field | Change Type | Detail |');
    expect(report.summary).toContain('| events | - | Collection Deleted | collection "events" was removed |');
    expect(report.summary).toContain(
      '| announcements | legacy_note | Field Deleted | field "legacy_note" was removed from collection "announcements" |',
    );
    expect(report.summary).toContain(
      '| announcements | priority | Type Changed | type changed from "integer" to "string" |',
    );
    expect(report.summary).toContain(
      '| announcements | body | NOT NULL Added | field "body" changed from nullable to NOT NULL |',
    );
  });
});

describe('runChecker', () => {
  it('fails closed with a parse-error summary when head snapshot YAML is malformed', () => {
    const invalidYaml = 'collections: [\n  - unterminated';

    const report = runChecker('collections: []\nfields: []', invalidYaml);

    expect(report.exitCode).toBe(1);
    expect(report.summary).toMatch(/failed to parse snapshot\.yaml/);
  });

  it('fails closed with a parse-error summary when base snapshot YAML is malformed', () => {
    const invalidYaml = 'collections: [\n  - unterminated';

    const report = runChecker(invalidYaml, 'collections: []\nfields: []');

    expect(report.exitCode).toBe(1);
    expect(report.summary).toMatch(/failed to parse snapshot\.yaml/);
  });

  it('treats a missing base file (null) as an empty snapshot, so a new PR-added file is additive-only', () => {
    const headYaml = `
collections:
  - collection: sponsors
    meta:
      note: new
fields:
  - collection: sponsors
    field: name
    type: string
    schema:
      data_type: character varying
      is_nullable: true
`;

    const report = runChecker(null, headYaml);

    expect(report.exitCode).toBe(0);
    expect(report.summary).toMatch(/additive/i);
  });
});

describe('end-to-end: additive-only-schema-check (7.2)', () => {
  const baseSnapshot = `
collections:
  - collection: announcements
    meta:
      note: base
  - collection: sponsors
    meta:
      note: base
fields:
  - collection: announcements
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: announcements
    field: title
    type: string
    schema:
      data_type: character varying
      is_nullable: true
  - collection: announcements
    field: body
    type: text
    schema:
      data_type: text
      is_nullable: true
  - collection: sponsors
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: sponsors
    field: name
    type: string
    schema:
      data_type: character varying
      is_nullable: true
`;

  it('additive-only case: new collection/field only -> success summary, exit code 0', () => {
    const headSnapshot = `
collections:
  - collection: announcements
    meta:
      note: updated
  - collection: sponsors
    meta:
      note: base
  - collection: events
    meta:
      note: new
fields:
  - collection: announcements
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: announcements
    field: title
    type: string
    schema:
      data_type: character varying
      is_nullable: true
  - collection: announcements
    field: body
    type: text
    schema:
      data_type: text
      is_nullable: true
  - collection: announcements
    field: published_at
    type: timestamp
    schema:
      data_type: timestamp
      is_nullable: true
  - collection: sponsors
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: sponsors
    field: name
    type: string
    schema:
      data_type: character varying
      is_nullable: true
  - collection: events
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
`;

    const report = runChecker(baseSnapshot, headSnapshot);

    expect(report.exitCode).toBe(0);
    expect(report.summary).toBe(
      'additive-only changes detected, no breaking changes found.',
    );
  });

  it('breaking case: collection delete + field delete + type change + NOT NULL 化 -> failure listing, exit code 1', () => {
    const headSnapshot = `
collections:
  - collection: announcements
    meta:
      note: updated
fields:
  - collection: announcements
    field: id
    type: integer
    schema:
      data_type: integer
      is_nullable: false
  - collection: announcements
    field: title
    type: text
    schema:
      data_type: text
      is_nullable: true
  - collection: announcements
    field: body
    type: text
    schema:
      data_type: text
      is_nullable: false
`;

    const report = runChecker(baseSnapshot, headSnapshot);

    expect(report.exitCode).toBe(1);
    expect(report.summary).toContain(
      '| Collection | Field | Change Type | Detail |',
    );
    expect(report.summary).toContain(
      '| sponsors | - | Collection Deleted |',
    );
    expect(report.summary).toContain(
      '| announcements | title | Type Changed |',
    );
    expect(report.summary).toContain(
      '| announcements | body | NOT NULL Added |',
    );
  });
});
