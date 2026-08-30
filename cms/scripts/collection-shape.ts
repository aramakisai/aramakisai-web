import type { CollectionConfig, Field, GlobalConfig } from 'payload';

export type FieldShape = {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly hasMany: boolean;
};

export type EntityShape = {
  readonly slug: string;
  readonly fields: readonly FieldShape[];
};

export type BreakingChange =
  | { readonly kind: 'entity_removed'; readonly slug: string }
  | { readonly kind: 'field_removed'; readonly slug: string; readonly field: string }
  | {
      readonly kind: 'type_changed';
      readonly slug: string;
      readonly field: string;
      readonly from: string;
      readonly to: string;
    }
  | { readonly kind: 'field_required'; readonly slug: string; readonly field: string }
  | { readonly kind: 'has_many_changed'; readonly slug: string; readonly field: string };

function isNamed(field: Field): field is Extract<Field, { name: string }> {
  return 'name' in field && typeof field.name === 'string';
}

export function toShape(entity: CollectionConfig | GlobalConfig): EntityShape {
  return {
    slug: entity.slug,
    fields: entity.fields.filter(isNamed).map((field) => ({
      name: field.name,
      type: field.type,
      required: 'required' in field ? field.required === true : false,
      hasMany: 'hasMany' in field ? field.hasMany === true : false,
    })),
  };
}

/**
 * additive-only ルールの機械強制。フィールド削除・型変更・必須化・多重度変更を破壊的とみなす。
 * 追加は破壊的でないため検出しない。
 */
export function detectBreakingChanges(
  base: readonly EntityShape[],
  head: readonly EntityShape[],
): readonly BreakingChange[] {
  const headBySlug = new Map(head.map((entity) => [entity.slug, entity]));
  const changes: BreakingChange[] = [];

  for (const baseEntity of base) {
    const headEntity = headBySlug.get(baseEntity.slug);
    if (!headEntity) {
      changes.push({ kind: 'entity_removed', slug: baseEntity.slug });
      continue;
    }

    const headFields = new Map(headEntity.fields.map((field) => [field.name, field]));
    for (const baseField of baseEntity.fields) {
      const headField = headFields.get(baseField.name);
      if (!headField) {
        changes.push({
          kind: 'field_removed',
          slug: baseEntity.slug,
          field: baseField.name,
        });
        continue;
      }
      if (headField.type !== baseField.type) {
        changes.push({
          kind: 'type_changed',
          slug: baseEntity.slug,
          field: baseField.name,
          from: baseField.type,
          to: headField.type,
        });
      }
      if (headField.required && !baseField.required) {
        changes.push({
          kind: 'field_required',
          slug: baseEntity.slug,
          field: baseField.name,
        });
      }
      if (headField.hasMany !== baseField.hasMany) {
        changes.push({
          kind: 'has_many_changed',
          slug: baseEntity.slug,
          field: baseField.name,
        });
      }
    }
  }

  return changes;
}

export function formatBreakingChange(change: BreakingChange): string {
  switch (change.kind) {
    case 'entity_removed':
      return `${change.slug}: コレクション/グローバルが削除された`;
    case 'field_removed':
      return `${change.slug}.${change.field}: フィールドが削除された`;
    case 'type_changed':
      return `${change.slug}.${change.field}: 型が ${change.from} から ${change.to} へ変わった`;
    case 'field_required':
      return `${change.slug}.${change.field}: 必須化された`;
    case 'has_many_changed':
      return `${change.slug}.${change.field}: 多重度が変わった`;
  }
}
