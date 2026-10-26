import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../src/migrations/', import.meta.url))
const migrationName = '20261025_160749_regional_sponsor_map_schema'

const localColumns = [
  'local_import_id',
  'local_map_category',
  'local_latitude',
  'local_longitude',
  'local_image_id',
  'local_image_alt',
  'local_image_decorative',
  'local_business_hours',
  'local_closed_days',
  'local_phone',
  'local_image_checksum',
] as const

const thumbnailColumns = [
  'sizes_thumbnail_url',
  'sizes_thumbnail_width',
  'sizes_thumbnail_height',
  'sizes_thumbnail_mime_type',
  'sizes_thumbnail_filesize',
  'sizes_thumbnail_filename',
] as const

type SnapshotTable = {
  columns: Record<string, unknown>
  indexes: Record<string, unknown>
  foreignKeys: Record<string, unknown>
}

type Snapshot = {
  id: string
  tables: Record<string, SnapshotTable>
  enums: Record<string, unknown>
  [key: string]: unknown
}

const addedKeys = (current: Record<string, unknown>, previous: Record<string, unknown>) =>
  Object.keys(current)
    .filter((key) => !(key in previous))
    .sort()

function expectCoordinateConstraints(source: string) {
  expect(source).toContain(
    'CONSTRAINT "sponsors_local_latitude_check" CHECK ("local_latitude" IS NULL OR "local_latitude" BETWEEN -90 AND 90)',
  )
  expect(source).toContain(
    'CONSTRAINT "sponsors_local_longitude_check" CHECK ("local_longitude" IS NULL OR "local_longitude" BETWEEN -180 AND 180)',
  )
}

function expectOnlyApprovedSnapshotChanges(generated: Snapshot, previous: Snapshot) {
  const sponsors = generated.tables['public.sponsors']
  const previousSponsors = previous.tables['public.sponsors']
  const media = generated.tables['public.media']
  const previousMedia = previous.tables['public.media']

  expect(addedKeys(sponsors.columns, previousSponsors.columns)).toEqual([...localColumns].sort())
  expect(addedKeys(media.columns, previousMedia.columns)).toEqual([...thumbnailColumns].sort())
  expect(addedKeys(sponsors.indexes, previousSponsors.indexes)).toEqual([
    'sponsors_local_image_idx',
    'sponsors_local_import_id_idx',
  ])
  expect(addedKeys(media.indexes, previousMedia.indexes)).toEqual([
    'media_sizes_thumbnail_sizes_thumbnail_filename_idx',
  ])
  expect(addedKeys(sponsors.foreignKeys, previousSponsors.foreignKeys)).toEqual([
    'sponsors_local_image_id_media_id_fk',
  ])
  expect(addedKeys(generated.enums, previous.enums)).toEqual([
    'public.enum_sponsors_local_map_category',
  ])

  const normalized = structuredClone(generated)
  normalized.id = previous.id
  for (const column of localColumns) delete normalized.tables['public.sponsors'].columns[column]
  for (const column of thumbnailColumns) delete normalized.tables['public.media'].columns[column]
  delete normalized.tables['public.sponsors'].indexes.sponsors_local_image_idx
  delete normalized.tables['public.sponsors'].indexes.sponsors_local_import_id_idx
  delete normalized.tables['public.media'].indexes
    .media_sizes_thumbnail_sizes_thumbnail_filename_idx
  delete normalized.tables['public.sponsors'].foreignKeys.sponsors_local_image_id_media_id_fk
  delete normalized.enums['public.enum_sponsors_local_map_category']

  expect(normalized).toEqual(previous)
}

const readGeneratedMigration = (extension: '.ts' | '.json') => {
  expect(
    migrationName.localeCompare('20261025_082958_add_student_exhibitions_versions'),
  ).toBeGreaterThan(0)
  return {
    filename: `${migrationName}${extension}`,
    source: readFileSync(`${migrationsDirectory}/${migrationName}${extension}`, 'utf8'),
  }
}

describe('regional sponsor map migration', () => {
  it('既存行へ値を補完せずnullable列とrelationを追加する', () => {
    const { source } = readGeneratedMigration('.ts')

    expect(source).toContain('ADD COLUMN "local_import_id" varchar')
    expect(source).toContain('ADD COLUMN "local_image_id" integer')
    expect(source).not.toMatch(/ADD COLUMN "local_(?!image_decorative)[^"]+"[^;]+NOT NULL/)
    expect(source).toContain('ON DELETE set null')
  })

  it('取り込みIDの一意indexと座標範囲制約を追加する', () => {
    const { source } = readGeneratedMigration('.ts')

    expect(source).toContain('CREATE UNIQUE INDEX "sponsors_local_import_id_idx"')
    expectCoordinateConstraints(source)
  })

  it('Media thumbnail列を同じmigrationで追加・除去する', () => {
    const { source } = readGeneratedMigration('.ts')

    for (const column of [
      'sizes_thumbnail_url',
      'sizes_thumbnail_width',
      'sizes_thumbnail_height',
      'sizes_thumbnail_mime_type',
      'sizes_thumbnail_filesize',
      'sizes_thumbnail_filename',
    ]) {
      expect(source).toContain(`ADD COLUMN "${column}"`)
      expect(source).toContain(`DROP COLUMN "${column}"`)
    }
  })

  it('downで追加した列・index・制約・enumを除去する', () => {
    const { source } = readGeneratedMigration('.ts')

    expect(source).toContain('DROP CONSTRAINT "sponsors_local_latitude_check"')
    expect(source).toContain('DROP CONSTRAINT "sponsors_local_longitude_check"')
    expect(source).toContain('DROP INDEX "sponsors_local_import_id_idx"')
    expect(source).toContain('DROP COLUMN "local_import_id"')
    expect(source).toContain('DROP TYPE "public"."enum_sponsors_local_map_category"')
  })

  it('最新snapshotが地域協賛とthumbnailの全列を保持する', () => {
    const { source } = readGeneratedMigration('.json')
    const latestDevSnapshot = JSON.parse(
      readFileSync(
        `${migrationsDirectory}/20261025_082958_add_student_exhibitions_versions.json`,
        'utf8',
      ),
    ) as Snapshot
    const generatedSnapshot = JSON.parse(source) as Snapshot

    expectOnlyApprovedSnapshotChanges(generatedSnapshot, latestDevSnapshot)

    for (const column of [...localColumns, ...thumbnailColumns]) {
      expect(source).toContain(`"${column}"`)
    }
  })

  it('旧migrationをindexへ残さず新migrationだけを登録する', () => {
    const { filename } = readGeneratedMigration('.ts')
    const migrationName = filename.replace(/\.ts$/, '')
    const indexSource = readFileSync(`${migrationsDirectory}/index.ts`, 'utf8')

    expect(indexSource).toContain(`name: '${migrationName}'`)
    expect(indexSource).not.toContain('20261021_075407_regional_sponsor_map')
    expect(indexSource).not.toContain('20261025_055003_add_media_thumbnail')
  })
})
