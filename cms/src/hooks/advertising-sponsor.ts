import type { CollectionBeforeValidateHook } from 'payload'
import { ValidationError } from 'payload'

import { blankToNull, hasValue } from './constraints'
import { isHttpUrl } from './http-url'

export const advertisingSponsorConstraint: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const effective = { ...(originalDoc ?? {}), ...(data ?? {}) }
  if (!Array.isArray(effective.type) || !effective.type.includes('ad')) return data

  const errors: { path: string; message: string }[] = []
  if (typeof effective.name !== 'string' || !effective.name.trim()) {
    errors.push({ path: 'name', message: '広告協賛の名称を入力してください' })
  }
  if (!['planA', 'planB', 'planC', 'planD'].includes(effective.tier)) {
    errors.push({ path: 'tier', message: '広告協賛のプランを選択してください' })
  }
  if (hasValue(blankToNull(effective.url)) && !isHttpUrl(effective.url)) {
    errors.push({ path: 'url', message: 'Webサイト URL は http または https の絶対URLにしてください' })
  }
  if (errors.length) throw new ValidationError({ collection: 'sponsors', errors })
  return data
}
