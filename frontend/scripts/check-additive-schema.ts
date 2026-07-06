import { parse as parseYaml } from 'yaml';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

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

function fieldKey(collection: string, field: string): string {
  return `${collection}::${field}`;
}

export function diffSchemas(
  base: ParsedSnapshot,
  head: ParsedSnapshot,
): SchemaDiffResult {
  const breakingChanges: BreakingChange[] = [];

  const headCollections = new Set(head.collections);
  const deletedCollections = new Set<string>();
  for (const collection of base.collections) {
    if (!headCollections.has(collection)) {
      deletedCollections.add(collection);
      breakingChanges.push({
        kind: 'collection-deleted',
        collection,
        detail: `collection "${collection}" was removed`,
      });
    }
  }

  const headFieldMap = new Map(
    head.fields.map((f) => [fieldKey(f.collection, f.field), f]),
  );
  const baseFieldMap = new Map(
    base.fields.map((f) => [fieldKey(f.collection, f.field), f]),
  );

  for (const baseField of base.fields) {
    if (deletedCollections.has(baseField.collection)) continue;
    if (!headFieldMap.has(fieldKey(baseField.collection, baseField.field))) {
      breakingChanges.push({
        kind: 'field-deleted',
        collection: baseField.collection,
        field: baseField.field,
        detail: `field "${baseField.field}" was removed from collection "${baseField.collection}"`,
      });
    }
  }

  for (const headField of head.fields) {
    if (deletedCollections.has(headField.collection)) continue;
    const baseField = baseFieldMap.get(
      fieldKey(headField.collection, headField.field),
    );
    if (!baseField) continue;
    if (baseField.schema === null || headField.schema === null) continue;

    if (
      baseField.type !== headField.type ||
      baseField.schema.data_type !== headField.schema.data_type
    ) {
      breakingChanges.push({
        kind: 'type-changed',
        collection: headField.collection,
        field: headField.field,
        detail: `type changed from "${baseField.type ?? baseField.schema.data_type}" to "${headField.type ?? headField.schema.data_type}"`,
      });
    }

    if (baseField.schema.is_nullable && !headField.schema.is_nullable) {
      breakingChanges.push({
        kind: 'not-null-added',
        collection: headField.collection,
        field: headField.field,
        detail: `field "${headField.field}" changed from nullable to NOT NULL`,
      });
    }
  }

  return { breakingChanges, isAdditiveOnly: breakingChanges.length === 0 };
}

export interface FormattedReport {
  summary: string;
  exitCode: number;
}

const CHANGE_KIND_LABELS: Record<BreakingChangeKind, string> = {
  'collection-deleted': 'Collection Deleted',
  'field-deleted': 'Field Deleted',
  'type-changed': 'Type Changed',
  'not-null-added': 'NOT NULL Added',
};

export function formatSummary(result: SchemaDiffResult): FormattedReport {
  if (result.breakingChanges.length === 0) {
    return {
      summary: 'additive-only changes detected, no breaking changes found.',
      exitCode: 0,
    };
  }

  const rows = result.breakingChanges.map(
    (change) =>
      `| ${change.collection} | ${change.field ?? '-'} | ${CHANGE_KIND_LABELS[change.kind]} | ${change.detail} |`,
  );

  const summary = [
    '| Collection | Field | Change Type | Detail |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');

  return { summary, exitCode: 1 };
}

export function runChecker(
  baseYamlText: string | null,
  headYamlText: string,
): FormattedReport {
  let base: ParsedSnapshot;
  let head: ParsedSnapshot;

  try {
    base =
      baseYamlText === null
        ? { collections: [], fields: [] }
        : parseSnapshot(baseYamlText);
    head = parseSnapshot(headYamlText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      summary: `failed to parse snapshot.yaml: ${message}`,
      exitCode: 1,
    };
  }

  return formatSummary(diffSchemas(base, head));
}

function readSnapshotFile(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
}

function main(): void {
  const [, , basePath, headPath] = process.argv;
  if (!basePath || !headPath) {
    console.error(
      'Usage: check-additive-schema.ts <base-snapshot-path> <head-snapshot-path>',
    );
    process.exitCode = 1;
    return;
  }

  const baseYamlText = readSnapshotFile(basePath);
  const headYamlText = readFileSync(headPath, 'utf-8');
  const report = runChecker(baseYamlText, headYamlText);

  console.log(report.summary);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${report.summary}\n`);
  }

  process.exitCode = report.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
