import { Fragment, memo, useState } from 'react'
import type { Verse } from '../lib/types'
import { vkey } from '../lib/types'
import { actions, today } from '../lib/store'
import { type Card, type Grade, isDue, isMemorized } from '../lib/srs'
import { AyahNumber } from './VerseCard'
import { Icon } from './Icon'

export type HideLevel = 0 | 1 | 2 | 3

export function isHidden(i: number, level: HideLevel): boolean {
  if (level === 0) return false
  if (level === 3) return true
  if (i === 0) return false // le premier mot sert d'indice
  return level === 1 ? i % 3 === 1 : i % 3 !== 0
}

export function cardLabel(c: Card | undefined): { text: string; cls: string } {
  if (!c) return { text: 'Nouveau', cls: 'new' }
  if (isDue(c, today())) return { text: 'À réviser', cls: 'due' }
  if (isMemorized(c)) return { text: `Mémorisé · revoir le ${formatDate(c.due)}`, cls: 'ok' }
  return { text: `En cours · revoir le ${formatDate(c.due)}`, cls: 'learning' }
}

export const formatDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: 0, label: 'Oublié', cls: 'bad' },
  { g: 3, label: 'Difficile', cls: 'hard' },
  { g: 4, label: 'Bien', cls: 'good' },
  { g: 5, label: 'Facile', cls: 'easy' },
]

interface Props {
  surah: number
  v: Verse
  level: HideLevel
  card: Card | undefined
  active: boolean
  showTranslation: boolean
  onListen(): void
}

export const MemorizeVerse = memo(function MemorizeVerse(p: Props) {
  const words = p.v.ar.split(' ')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [all, setAll] = useState(false)
  const label = cardLabel(p.card)
  const reveal = (i: number) => setRevealed((r) => new Set(r).add(i))
  const grade = (g: Grade) => {
    actions.grade(vkey(p.surah, p.v.n), g)
    setRevealed(new Set())
    setAll(false)
  }
  return (
    <article id={`v${p.v.n}`} data-verse={p.v.n} className={`verse memo ${p.active ? 'active' : ''}`}>
      <div className="verse-head">
        <span className="vref">
          {p.surah}:{p.v.n} <span className={`status ${label.cls}`}>{label.text}</span>
        </span>
        <div className="verse-actions">
          <button className="icon-btn" onClick={p.onListen} aria-label="Écouter ce verset" title="Écouter">
            <Icon name="headphones" size={16} />
          </button>
          <button className="icon-btn" onClick={() => setAll(!all)} aria-label="Tout révéler" title="Tout révéler">
            <Icon name={all ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </div>
      </div>
      <p className="ar" lang="ar" dir="rtl">
        {words.map((w, i) => {
          const hidden = !all && !revealed.has(i) && isHidden(i, p.level)
          return (
            <Fragment key={i}>
              {i > 0 && ' '}
              {hidden ? (
                <span
                  className="word hidden"
                  role="button"
                  tabIndex={0}
                  onClick={() => reveal(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && reveal(i)}
                  aria-label="Révéler le mot"
                >
                  {w}
                </span>
              ) : (
                <span className="word">{w}</span>
              )}
            </Fragment>
          )
        })}{' '}
        <AyahNumber n={p.v.n} />
      </p>
      {p.showTranslation && <p className="fr">{p.v.fr}</p>}
      <div className="grades">
        {GRADES.map((g) => (
          <button key={g.g} className={`grade ${g.cls}`} onClick={() => grade(g.g)}>
            {g.label}
          </button>
        ))}
      </div>
    </article>
  )
})
