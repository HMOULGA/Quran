// Lecteur audio verset par verset : répétition de chaque verset, boucle sur une plage, vitesse.
import { useSyncExternalStore } from 'react'
import { audioUrl } from './reciters'

export interface PlayRequest {
  surah: number
  from: number
  to: number
  repeatVerse: number // 0 = infini
  repeatRange: number // 0 = infini
  reciter: string
  rate: number
  bismillah: boolean
}

export interface PlayerState {
  playing: boolean
  loading: boolean
  surah: number | null
  verse: number | null
  /** Indique que la basmala d'ouverture est en cours de lecture. */
  inBismillah: boolean
  verseRep: number
  rangeRep: number
  request: PlayRequest | null
  error: string | null
}

const audio = typeof Audio !== 'undefined' ? new Audio() : (null as unknown as HTMLAudioElement)
const preload = typeof Audio !== 'undefined' ? new Audio() : (null as unknown as HTMLAudioElement)
if (preload) preload.preload = 'auto'

let st: PlayerState = {
  playing: false,
  loading: false,
  surah: null,
  verse: null,
  inBismillah: false,
  verseRep: 1,
  rangeRep: 1,
  request: null,
  error: null,
}
const subs = new Set<() => void>()
const set = (p: Partial<PlayerState>) => {
  st = { ...st, ...p }
  subs.forEach((f) => f())
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => st,
  )
}

function load(surah: number, verse: number, bism: boolean) {
  const r = st.request!
  set({ verse, surah, inBismillah: bism, loading: true, error: null })
  audio.src = bism ? audioUrl(r.reciter, 1, 1) : audioUrl(r.reciter, surah, verse)
  audio.playbackRate = r.rate
  audio.play().catch((e) => {
    if (e?.name !== 'AbortError') set({ playing: false, loading: false, error: 'Lecture impossible (connexion ?)' })
  })
  // Préchargement du verset suivant
  const next = !bism && verse < r.to ? verse + 1 : bism ? verse : null
  if (next) preload.src = audioUrl(r.reciter, surah, next)
}

if (audio) {
  audio.addEventListener('playing', () => set({ loading: false, playing: true }))
  audio.addEventListener('waiting', () => set({ loading: true }))
  audio.addEventListener('error', () => {
    if (st.request) set({ playing: false, loading: false, error: 'Audio indisponible (vérifiez la connexion)' })
  })
  audio.addEventListener('ended', () => {
    const r = st.request
    if (!r || st.verse == null) return
    if (st.inBismillah) return load(r.surah, st.verse, false)
    if (r.repeatVerse === 0 || st.verseRep < r.repeatVerse) {
      set({ verseRep: st.verseRep + 1 })
      return load(r.surah, st.verse, false)
    }
    if (st.verse < r.to) {
      set({ verseRep: 1 })
      return load(r.surah, st.verse + 1, false)
    }
    if (r.repeatRange === 0 || st.rangeRep < r.repeatRange) {
      set({ verseRep: 1, rangeRep: st.rangeRep + 1 })
      return start(r.from)
    }
    set({ playing: false, loading: false })
  })
}

function start(verse: number) {
  const r = st.request!
  const bism = r.bismillah && verse === 1 && r.surah !== 1 && r.surah !== 9
  load(r.surah, verse, bism)
}

export const player = {
  play(req: PlayRequest) {
    set({ request: req, verseRep: 1, rangeRep: 1, playing: true })
    start(req.from)
  },
  pause() {
    audio.pause()
    set({ playing: false, loading: false })
  },
  resume() {
    if (!st.request) return
    audio.play().then(() => set({ playing: true }))
  },
  stop() {
    audio.pause()
    audio.removeAttribute('src')
    set({ playing: false, loading: false, request: null, verse: null, surah: null, inBismillah: false })
  },
  next() {
    const r = st.request
    if (!r || st.verse == null) return
    if (st.verse < r.to) {
      set({ verseRep: 1 })
      load(r.surah, st.verse + 1, false)
    }
  },
  prev() {
    const r = st.request
    if (!r || st.verse == null) return
    if (st.verse > r.from) {
      set({ verseRep: 1 })
      load(r.surah, st.verse - 1, false)
    }
  },
  setRate(rate: number) {
    audio.playbackRate = rate
    if (st.request) set({ request: { ...st.request, rate } })
  },
  update(patch: Partial<PlayRequest>) {
    if (st.request) set({ request: { ...st.request, ...patch } })
  },
}
