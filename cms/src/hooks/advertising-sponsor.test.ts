import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'

import { Sponsors } from '../collections/sponsors'
import { advertisingSponsorConstraint } from './advertising-sponsor'
import { localSponsorMapConstraint } from './local-sponsor-map'

const valid = { type: ['ad'], name: '広告協賛', tier: 'planA', logo: 1, url: 'https://example.test' }
const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
  advertisingSponsorConstraint({ data, originalDoc, operation: originalDoc ? 'update' : 'create' } as never)

function expectError(data: Record<string, unknown>, path: string, originalDoc?: Record<string, unknown>) {
  try {
    run(data, originalDoc)
    throw new Error('expected ValidationError')
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).data?.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path, message: expect.any(String) })]),
    )
  }
}

describe('広告協賛の保存時検証', () => {
  it('既存の地域・出店フックとともに collection に登録される', () => {
    expect(Sponsors.hooks?.beforeValidate).toContain(advertisingSponsorConstraint)
    expect(Sponsors.hooks?.beforeValidate).toContain(localSponsorMapConstraint)
    expect(Sponsors.hooks?.beforeValidate).toHaveLength(4)
  })

  it.each(['planA', 'planB', 'planC'])('%s はロゴ必須', (tier) => {
    expect(run({ ...valid, tier })).toEqual({ ...valid, tier })
    expectError({ ...valid, tier, logo: null }, 'logo')
  })

  it('Dはロゴなしでも受理し、名前と有効なプランは必須', () => {
    expect(run({ ...valid, tier: 'planD', logo: null })).toMatchObject({ tier: 'planD', logo: null })
    for (const name of ['', '  ', null]) expectError({ ...valid, name }, 'name')
    for (const tier of [null, '', 'planE']) expectError({ ...valid, tier }, 'tier')
  })

  it.each([null, undefined, '', '  ', 'http://example.test', 'https://example.test'])('URL %s を受理', (url) => {
    expect(run({ ...valid, url })).toEqual({ ...valid, url })
  })

  it.each(['/relative', 'ftp://example.test', 'javascript:alert(1)', 'invalid'])('不正なURL %s を拒否', (url) => {
    expectError({ ...valid, url }, 'url')
  })

  it('部分更新の未送信値は保持し、明示的な空値や種別変更は検証する', () => {
    expect(run({ description: '更新' }, valid)).toEqual({ description: '更新' })
    expectError({ logo: null }, 'logo', valid)
    expectError({ name: ' ' }, 'name', valid)
    expectError({ tier: null }, 'tier', valid)
    expectError({ type: ['local', 'ad'] }, 'tier', { type: ['local'], name: '地域' })
    expect(run({ type: ['other'], logo: null }, valid)).toEqual({ type: ['other'], logo: null })
  })

  it('広告以外に条件を課さず、複数種別に広告を含む場合は検証する', () => {
    expect(run({ type: ['vendor'], name: '既存', tier: null, url: 'invalid' })).toMatchObject({ tier: null })
    expectError({ ...valid, type: ['local', 'ad'], logo: null }, 'logo')
    expectError({ ...valid, type: ['local', 'ad'], url: 'bad' }, 'url')
  })

  it('地域と広告の両方の検証が実行される', async () => {
    const localAndAd = { ...valid, type: ['local', 'ad'], url: '  ' }
    const normalized = await localSponsorMapConstraint({ data: localAndAd } as never)
    expect(run(normalized as Record<string, unknown>)).toMatchObject({ url: null })
  })
})
