import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(
    new URL('../src/migrations/20261021_075407_regional_sponsor_map.ts', import.meta.url),
  ),
  'utf8',
)

describe('regional sponsor map migration', () => {
  it('既存行へ値を補完せずnullable列とrelationを追加する', () => {
    expect(source).toContain('ADD COLUMN "local_import_id" varchar')
    expect(source).toContain('ADD COLUMN "local_image_id" integer')
    expect(source).not.toMatch(/ADD COLUMN "local_(?!image_decorative)[^"]+"[^;]+NOT NULL/)
    expect(source).toContain('ON DELETE set null')
  })

  it('取り込みIDの一意indexと座標範囲制約を追加する', () => {
    expect(source).toContain('CREATE UNIQUE INDEX "sponsors_local_import_id_idx"')
    expect(source).toContain('sponsors_local_latitude_check')
    expect(source).toContain('sponsors_local_longitude_check')
  })

  it('downで追加した列・index・制約・enumを除去する', () => {
    expect(source).toContain('DROP CONSTRAINT "sponsors_local_latitude_check"')
    expect(source).toContain('DROP CONSTRAINT "sponsors_local_longitude_check"')
    expect(source).toContain('DROP INDEX "sponsors_local_import_id_idx"')
    expect(source).toContain('DROP COLUMN "local_import_id"')
    expect(source).toContain('DROP TYPE "public"."enum_sponsors_local_map_category"')
  })
})
