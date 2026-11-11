import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MapPoints } from './map-points'

describe('構内マップの施設地点', () => {
  it('表示名は既存レコードと互換性のある任意項目', () => {
    const field = MapPoints.fields.find((item) => 'name' in item && item.name === 'label')
    expect(field).toMatchObject({ type: 'text' })
    expect(field).not.toHaveProperty('required', true)
  })

  it('ポスターは Media を再利用し、お笑いライブ受付のときだけ編集欄を表示する', () => {
    const field = MapPoints.fields.find((item) => 'name' in item && item.name === 'poster')
    expect(field).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect(field).not.toHaveProperty('required', true)
    const condition = (field as unknown as { admin: { condition: (data: Record<string, string>) => boolean } }).admin.condition
    expect(condition({ kind: 'reception', reception_type: 'comedy' })).toBe(true)
    expect(condition({ kind: 'reception', reception_type: 'general' })).toBe(false)
    expect(condition({ kind: 'garbage_station', reception_type: 'comedy' })).toBe(false)
  })

  it('登録用データは確認済みの11地点と座標に一致する', () => {
    const points = JSON.parse(
      readFileSync(new URL('../../data/campus-map-facilities.json', import.meta.url), 'utf8'),
    )
    expect(points).toEqual([
      { kind: 'reception', latitude: 36.431256, longitude: 139.044215 },
      { kind: 'reception', latitude: 36.431465, longitude: 139.046116 },
      { kind: 'garbage_station', latitude: 36.430236, longitude: 139.044431 },
      { kind: 'garbage_station', latitude: 36.430679, longitude: 139.044508 },
      { kind: 'garbage_station', latitude: 36.430839, longitude: 139.044639 },
      { kind: 'garbage_station', latitude: 36.431296, longitude: 139.044458 },
      { kind: 'garbage_station', latitude: 36.430922, longitude: 139.045076 },
      { kind: 'garbage_station', latitude: 36.431674, longitude: 139.045252 },
      { kind: 'garbage_station', latitude: 36.430857, longitude: 139.04606 },
      { kind: 'garbage_station', latitude: 36.431161, longitude: 139.04589 },
      {
        kind: 'reception',
        label: 'ママタルトお笑いライブ専用受付',
        latitude: 36.4302,
        longitude: 139.0447,
      },
    ])
    expect(
      new Set(
        points.map(
          (point: { latitude: number; longitude: number }) =>
            `${point.latitude},${point.longitude}`,
        ),
      ).size,
    ).toBe(11)
  })
})
