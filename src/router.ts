// Routage minimal par hash (fonctionne en web, Electron et Capacitor, et gère le bouton retour).
import { useSyncExternalStore } from 'react'

export type Mode = 'lire' | 'memoriser' | 'reciter'

export type Route =
  | { name: 'home' }
  | { name: 'surahs' }
  | { name: 'reader'; surah: number; verse?: number; mode: Mode }
  | { name: 'review' }
  | { name: 'progress' }
  | { name: 'settings' }

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const q = new URLSearchParams(query)
  const parts = path.split('/').filter(Boolean)
  switch (parts[0]) {
    case 'sourates':
      return { name: 'surahs' }
    case 's': {
      const surah = Math.min(114, Math.max(1, Number(parts[1]) || 1))
      const verse = q.get('v') ? Number(q.get('v')) : undefined
      const m = q.get('m')
      const mode: Mode = m === 'memoriser' || m === 'reciter' ? m : 'lire'
      return { name: 'reader', surah, verse, mode }
    }
    case 'revision':
      return { name: 'review' }
    case 'progres':
      return { name: 'progress' }
    case 'reglages':
      return { name: 'settings' }
    default:
      return { name: 'home' }
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/'
    case 'surahs':
      return '#/sourates'
    case 'reader': {
      const q = new URLSearchParams()
      if (r.verse) q.set('v', String(r.verse))
      if (r.mode !== 'lire') q.set('m', r.mode)
      const qs = q.toString()
      return `#/s/${r.surah}${qs ? '?' + qs : ''}`
    }
    case 'review':
      return '#/revision'
    case 'progress':
      return '#/progres'
    case 'settings':
      return '#/reglages'
  }
}

export function navigate(r: Route, replace = false) {
  const h = href(r)
  if (replace) history.replaceState(null, '', h)
  else location.hash = h
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

let current = parse(location.hash)
window.addEventListener('hashchange', () => {
  current = parse(location.hash)
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb)
      return () => window.removeEventListener('hashchange', cb)
    },
    () => current,
  )
}
