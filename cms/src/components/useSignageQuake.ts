'use client'

import { useCallback, useEffect, useState } from 'react'

import { dismissQuake, fetchQuakeStatus, type QuakeFetchResult } from './signage-quake'

const POLL_MS = 10_000

export function useSignageQuake() {
  const [result, setResult] = useState<QuakeFetchResult | undefined>() // undefined は読み込み前
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const r = await fetchQuakeStatus()
      if (alive) setResult(r)
    }
    let timer: ReturnType<typeof setInterval> | undefined
    // 非表示のタブではリレーを叩かない
    const sync = () => {
      clearInterval(timer)
      timer = undefined
      if (document.visibilityState === 'visible') {
        void load()
        timer = setInterval(() => void load(), POLL_MS)
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const dismiss = useCallback(async () => {
    setSaving(true)
    setFailed(false)
    const r = await dismissQuake()
    if ('status' in r) setResult(r)
    else setFailed(true)
    setSaving(false)
  }, [])

  return { result, saving, failed, dismiss }
}
