import { useMemo, useState } from 'react'
import { useIndex, useSurah } from '../hooks'
import { actions, today, useStore } from '../lib/store'
import { isDue, type Grade } from '../lib/srs'
import { parseKey, type VerseKey } from '../lib/types'
import { player } from '../lib/audio'
import { GRADES, formatDate } from '../components/MemorizeVerse'
import { AyahNumber } from '../components/VerseCard'
import { Icon } from '../components/Icon'

export function Review() {
  const srs = useStore((s) => s.srs)
  const t = today()
  // La file est figée au début de la séance pour ne pas sauter de carte en cours de route
  const [queue] = useState<VerseKey[]>(() =>
    (Object.entries(srs) as [VerseKey, (typeof srs)[VerseKey]][])
      .filter(([, c]) => isDue(c, t))
      .sort((a, b) => a[1].due.localeCompare(b[1].due) || compare(a[0], b[0]))
      .map(([k]) => k),
  )
  const [pos, setPos] = useState(0)
  const upcoming = useMemo(
    () =>
      Object.values(srs)
        .filter((c) => !isDue(c, t))
        .map((c) => c.due)
        .sort()[0],
    [srs, t],
  )

  if (queue.length === 0 || pos >= queue.length) {
    return (
      <div className="screen">
        <h1 className="page-title">Révision</h1>
        <div className="card empty-state">
          <Icon name="check" size={36} />
          <h2>{queue.length ? 'Séance terminée' : 'Rien à réviser aujourd’hui'}</h2>
          <p className="muted">
            {queue.length
              ? `${queue.length} verset${queue.length > 1 ? 's' : ''} révisé${queue.length > 1 ? 's' : ''}. Revenez demain pour la suite.`
              : 'Ajoutez des versets depuis le mode Mémoriser ou après une récitation.'}
            {upcoming && ` Prochaine révision : ${formatDate(upcoming)}.`}
          </p>
          <a className="btn primary" href="#/sourates">
            Choisir une sourate
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1 className="page-title">Révision</h1>
      <div className="progress-line">
        <span style={{ width: `${(pos / queue.length) * 100}%` }} />
      </div>
      <p className="muted small">
        {pos + 1} / {queue.length}
      </p>
      <ReviewCard key={queue[pos]} k={queue[pos]} onDone={() => setPos(pos + 1)} />
    </div>
  )
}

const compare = (a: string, b: string) => {
  const x = parseKey(a)
  const y = parseKey(b)
  return x.s - y.s || x.v - y.v
}

function ReviewCard({ k, onDone }: { k: VerseKey; onDone(): void }) {
  const { s, v } = parseKey(k)
  const idx = useIndex()
  const verses = useSurah(s)
  const settings = useStore((st) => st.settings)
  const [shown, setShown] = useState(false)
  const verse = verses?.[v - 1]
  const prev = verses?.[v - 2]
  if (!verse || !idx) return <div className="card loading">Chargement…</div>
  const words = verse.ar.split(' ')
  const grade = (g: Grade) => {
    actions.grade(k, g)
    onDone()
  }
  const listen = () =>
    player.play({
      surah: s,
      from: v,
      to: v,
      repeatVerse: 1,
      repeatRange: 1,
      reciter: settings.reciter,
      rate: settings.rate,
      bismillah: false,
    })
  return (
    <div className="card review-card">
      <div className="verse-head">
        <span className="vref">
          {idx[s - 1].tr} · verset {v}
        </span>
        <div className="verse-actions">
          <button className="icon-btn" onClick={listen} aria-label="Écouter" title="Écouter">
            <Icon name="headphones" size={16} />
          </button>
          <a className="icon-btn" href={`#/s/${s}?v=${v}&m=reciter`} aria-label="Réciter au micro" title="Réciter au micro">
            <Icon name="mic" size={16} />
          </a>
        </div>
      </div>
      {prev && (
        <p className="ar context" lang="ar" dir="rtl">
          … {prev.ar.split(' ').slice(-4).join(' ')} <AyahNumber n={prev.n} />
        </p>
      )}
      <p className="ar" lang="ar" dir="rtl">
        {shown ? (
          verse.ar
        ) : (
          <>
            <span className="word">{words[0]}</span>{' '}
            {words.slice(1).map((w, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span className="word hidden static">{w}</span>
              </span>
            ))}
          </>
        )}{' '}
        <AyahNumber n={v} />
      </p>
      {shown && settings.showTranslation && <p className="fr">{verse.fr}</p>}
      {!shown ? (
        <button className="btn primary wide" onClick={() => setShown(true)}>
          Récitez de mémoire, puis afficher le verset
        </button>
      ) : (
        <div className="grades">
          {GRADES.map((g) => (
            <button key={g.g} className={`grade ${g.cls}`} onClick={() => grade(g.g)}>
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
