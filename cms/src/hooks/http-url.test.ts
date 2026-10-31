import { describe, expect, it } from 'vitest'

import { isHttpUrl } from './http-url'

describe('isHttpUrl', () => {
  it.each(['http://example.invalid/path', 'https://example.invalid/path'])('%s を受理する', (value) => {
    expect(isHttpUrl(value)).toBe(true)
  })

  it.each([null, undefined, '', '  ', 'ftp://example.invalid/file', 'javascript:alert(1)', '/relative/path', 'not-a-url'])(
    '%s を拒否する',
    (value) => {
      expect(isHttpUrl(value)).toBe(false)
    },
  )
})
