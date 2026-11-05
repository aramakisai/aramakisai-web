import { describe, expect, it } from 'vitest'

import { isBlockedInternalApi } from './proxy'

const blocked = (method: string, path: string, query = '') => isBlockedInternalApi(method, path, new URLSearchParams(query))

describe('isBlockedInternalApi', () => {
  it('payload-jobs-stats と payload-migrations は全メソッドを塞ぐ', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(blocked(method, '/api/globals/payload-jobs-stats')).toBe(true)
      expect(blocked(method, '/api/payload-migrations')).toBe(true)
      expect(blocked(method, '/api/payload-migrations/1')).toBe(true)
    }
  })

  it('payload-preferences は管理画面が使う経路だけ通す', () => {
    expect(blocked('GET', '/api/payload-preferences/nav')).toBe(false)
    expect(blocked('POST', '/api/payload-preferences/nav')).toBe(false)
    expect(blocked('DELETE', '/api/payload-preferences/nav')).toBe(false)
    expect(blocked('DELETE', '/api/payload-preferences', 'where[user.value][equals]=1')).toBe(false)
    expect(blocked('PATCH', '/api/payload-preferences/nav')).toBe(true)
    expect(blocked('PATCH', '/api/payload-preferences')).toBe(true)
    expect(blocked('GET', '/api/payload-preferences')).toBe(true)
    expect(blocked('DELETE', '/api/payload-preferences')).toBe(true)
    expect(blocked('POST', '/api/payload-preferences')).toBe(true)
  })

  it('payload-locked-documents は一覧 GET と /:id の PATCH/DELETE だけ通す', () => {
    expect(blocked('GET', '/api/payload-locked-documents')).toBe(false)
    expect(blocked('PATCH', '/api/payload-locked-documents/1')).toBe(false)
    expect(blocked('DELETE', '/api/payload-locked-documents/1')).toBe(false)
    expect(blocked('POST', '/api/payload-locked-documents')).toBe(true)
    expect(blocked('PATCH', '/api/payload-locked-documents')).toBe(true)
    expect(blocked('DELETE', '/api/payload-locked-documents')).toBe(true)
    expect(blocked('GET', '/api/payload-locked-documents/1')).toBe(true)
    expect(blocked('GET', '/api/payload-locked-documents/count')).toBe(true)
  })

  it('末尾スラッシュや重複スラッシュでも判定が変わらない', () => {
    expect(blocked('GET', '/api/payload-migrations/')).toBe(true)
    expect(blocked('GET', '/api//payload-migrations')).toBe(true)
  })

  it('他のパスは塞がない', () => {
    expect(blocked('GET', '/api/users')).toBe(false)
    expect(blocked('GET', '/api/globals/site-settings')).toBe(false)
    expect(blocked('GET', '/admin/collections/payload-migrations')).toBe(false)
  })
})
