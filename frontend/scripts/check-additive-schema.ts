import { parse as parseYaml } from 'yaml';

export interface SnapshotField {
  collection: string;
  field: string;
  type: string | null;
  schema: { data_type: string | null; is_nullable: boolean } | null;
}

export interface ParsedSnapshot {
  collections: string[];
  fields: SnapshotField[];
}

export type BreakingChangeKind =
  'collection-deleted' | 'field-deleted' | 'type-changed' | 'not-null-added';

export interface BreakingChange {
  kind: BreakingChangeKind;
  collection: string;
  field?: string;
  detail: string;
}

export interface SchemaDiffResult {
  breakingChanges: BreakingChange[];
  isAdditiveOnly: boolean;
}

interface RawSnapshotCollection {
  collection: string;
}

interface RawSnapshotField {
  collection: string;
  field: string;
  type?: string | null;
  schema?: { data_type?: string | null; is_nullable?: boolean } | null;
}

interface RawSnapshot {
  collections?: RawSnapshotCollection[];
  fields?: RawSnapshotField[];
}

export function parseSnapshot(yamlText: string): ParsedSnapshot {
  const raw = parseYaml(yamlText) as RawSnapshot;

  const collections = Array.from(
    new Set((raw.collections ?? []).map((c) => c.collection)),
  );

  const fields: SnapshotField[] = (raw.fields ?? []).map((f) => ({
    collection: f.collection,
    field: f.field,
    type: f.type ?? null,
    schema: f.schema
      ? {
          data_type: f.schema.data_type ?? null,
          is_nullable: f.schema.is_nullable ?? true,
        }
      : null,
  }));

  return { collections, fields };
}
