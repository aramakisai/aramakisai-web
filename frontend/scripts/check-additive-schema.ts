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
  | "collection-deleted"
  | "field-deleted"
  | "type-changed"
  | "not-null-added";

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
