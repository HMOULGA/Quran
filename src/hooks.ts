import { useEffect, useState } from 'react'
import { loadIndex, loadSurah } from './lib/data'
import type { SurahMeta, Verse } from './lib/types'

export function useIndex(): SurahMeta[] | null {
  const [idx, setIdx] = useState<SurahMeta[] | null>(null)
  useEffect(() => {
    loadIndex().then(setIdx)
  }, [])
  return idx
}

export function useSurah(id: number): Verse[] | null {
  const [state, setState] = useState<{ id: number; verses: Verse[] } | null>(null)
  useEffect(() => {
    let alive = true
    loadSurah(id).then((verses) => alive && setState({ id, verses }))
    return () => {
      alive = false
    }
  }, [id])
  return state && state.id === id ? state.verses : null
}
