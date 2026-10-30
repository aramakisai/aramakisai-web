import { describe, expect, it } from 'vitest'

import { isValidOptionalHttpUrl } from './http-url'

describe('isValidOptionalHttpUrl', () => {
  it.each([null, undefined, '', '  \t\n'])('空欄 %s を受理する', (value) => {
    expect(isValidOptionalHttpUrl(value)).toBe(true)
  })

  it.each(['http://example.invalid/path', 'https://example.invalid/path'])(
    '%s を受理する',
    (value) => {
      expect(isValidOptionalHttpUrl(value)).toBe(true)
    },
  )

  it.each(['ftp://example.invalid/file', 'javascript:alert(1)', '/relative/path', 'not-a-url'])(
    '%s を拒否する',
    (value) => {
      expect(isValidOptionalHttpUrl(value)).toBe(false)
    },
  )
})
