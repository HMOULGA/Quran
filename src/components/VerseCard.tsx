import { memo } from 'react'
import type { Verse } from '../lib/types'
import { vkey } from '../lib/types'
import { arabicNumber } from '../lib/data'
import { actions } from '../lib/store'
import { Icon } from './Icon'

export function AyahNumber({ n }: { n: number }) {
  return (
    <span className="ayah-num" aria-label={`verset ${n}`}>
      {arabicNumber(n)}
    </span>
  )
}

interface Props {
  surah: number
  v: Verse
  active: boolean
  bookmarked: boolean
  inReview: boolean
  showTranslation: boolean
  showTranslit: boolean
  onPlay(): void
  onLoop(): void
}

export const VerseCard = memo(function VerseCard(p: Props) {
  const k = vkey(p.surah, p.v.n)
  return (
    <article id={`v${p.v.n}`} data-verse={p.v.n} className={`verse ${p.active ? 'active' : ''}`}>
      <div className="verse-head">
        <span className="vref">
          {p.surah}:{p.v.n}
          {p.v.sajda && <span className="tag">sajda</span>}
        </span>
        <div className="verse-actions">
          <button className="icon-btn" onClick={p.onPlay} aria-label="Écouter à partir de ce verset" title="Écouter à partir d’ici">
            <Icon name="play" size={16} fill />
          </button>
          <button className="icon-btn" onClick={p.onLoop} aria-label="Répéter ce verset en boucle" title="Répéter en boucle">
            <Icon name="repeat" size={16} />
          </button>
          <button
            className={`icon-btn ${p.bookmarked ? 'on' : ''}`}
            onClick={() => actions.toggleBookmark(k)}
            aria-label="Marque-page"
            title="Marque-page"
          >
            <Icon name="bookmark" size={16} fill={p.bookmarked} />
          </button>
          <button
            className={`icon-btn ${p.inReview ? 'on' : ''}`}
            onClick={() => (p.inReview ? actions.forget(k) : actions.grade(k, 3))}
            aria-label={p.inReview ? 'Retirer de la révision' : 'Ajouter à la révision'}
            title={p.inReview ? 'Retirer de la révision' : 'Ajouter à la révision'}
          >
            <Icon name="brain" size={16} />
          </button>
        </div>
      </div>
      <p className="ar" lang="ar" dir="rtl">
        {p.v.ar} <AyahNumber n={p.v.n} />
      </p>
      {p.showTranslit && <p className="translit">{p.v.tr}</p>}
      {p.showTranslation && <p className="fr">{p.v.fr}</p>}
    </article>
  )
})
