// État persistant de l'application (localStorage) avec un petit abonnement React.
import { useSyncExternalStore } from 'react'
import type { VerseKey } from './types'
import { RECITERS } from './reciters'
import { type Card, type Grade, review } from './srs'

export type Engine = 'auto' | 'native' | 'webspeech' | 'whisper'
export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  reciter: string
  rate: number
  fontSize: number
  showTranslation: boolean
  showTranslit: boolean
  theme: Theme
  engine: Engine
  whisperModel: string
  dailyGoal: number
  playBismillah: boolean
}

export interface DayActivity {
  read: number
  reviewed: number
  recited: number
}

export interface State {
  settings: Settings
  last: { surah: number; verse: number } | null
  bookmarks: VerseKey[]
  activity: Record<string, DayActivity>
  srs: Record<VerseKey, Card>
}

const KEY = 'itqan:v1'

export const DEFAULT_SETTINGS: Settings = {
  reciter: RECITERS[0].id,
  rate: 1,
  fontSize: 32,
  showTranslation: true,
  showTranslit: false,
  theme: 'auto',
  engine: 'auto',
  whisperModel: 'iqbalaesthetic/Basira',
  dailyGoal: 10,
  playBismillah: true,
}

function load(): State {
  const empty: State = { settings: DEFAULT_SETTINGS, last: null, bookmarks: [], activity: {}, srs: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return { ...empty, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
  } catch {
    return empty
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* stockage indisponible : on garde l'état en mémoire */
  }
  listeners.forEach((l) => l())
}

export function getState() {
  return state
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => selector(state),
  )
}

export const today = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const actions = {
  setSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
  },
  setLast(surah: number, verse: number) {
    if (state.last?.surah === surah && state.last?.verse === verse) return
    commit({ ...state, last: { surah, verse } })
  },
  toggleBookmark(k: VerseKey) {
    const has = state.bookmarks.includes(k)
    commit({ ...state, bookmarks: has ? state.bookmarks.filter((b) => b !== k) : [...state.bookmarks, k] })
  },
  logActivity(kind: keyof DayActivity, amount = 1) {
    const d = today()
    const cur = state.activity[d] ?? { read: 0, reviewed: 0, recited: 0 }
    commit({ ...state, activity: { ...state.activity, [d]: { ...cur, [kind]: cur[kind] + amount } } })
  },
  grade(k: VerseKey, g: Grade) {
    const card = review(state.srs[k], g, today())
    const d = today()
    const cur = state.activity[d] ?? { read: 0, reviewed: 0, recited: 0 }
    commit({
      ...state,
      srs: { ...state.srs, [k]: card },
      activity: { ...state.activity, [d]: { ...cur, reviewed: cur.reviewed + 1 } },
    })
  },
  forget(k: VerseKey) {
    const srs = { ...state.srs }
    delete srs[k]
    commit({ ...state, srs })
  },
  exportData(): string {
    return JSON.stringify(state, null, 2)
  },
  importData(json: string) {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('Fichier invalide')
    commit({ ...state, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } })
  },
  reset() {
    commit({ settings: state.settings, last: null, bookmarks: [], activity: {}, srs: {} })
  },
}

/** Nombre de jours consécutifs avec une activité, jusqu'à aujourd'hui (ou hier). */
export function streak(activity: Record<string, DayActivity>): number {
  const active = (d: string) => {
    const a = activity[d]
    return !!a && a.read + a.reviewed + a.recited > 0
  }
  const d = new Date()
  if (!active(today(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (active(today(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
