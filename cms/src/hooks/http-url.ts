import { blankToNull, hasValue } from './constraints'

export function isValidOptionalHttpUrl(value: unknown): boolean {
  if (!hasValue(blankToNull(value))) return true
  try {
    const parsed = new URL(String(value))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
