import { useMemo } from 'react'
import { useIndex } from '../hooks'
import { streak, today, useStore } from '../lib/store'
import { isDue, isMemorized } from '../lib/srs'
import { Icon } from '../components/Icon'

const DAYS = 14

export function Progress() {
  const idx = useIndex()
  const activity = useStore((s) => s.activity)
  const srs = useStore((s) => s.srs)
  const bookmarks = useStore((s) => s.bookmarks)
  const t = today()

  const cards = Object.entries(srs)
  const memorized = cards.filter(([, c]) => isMemorized(c)).length
  const due = cards.filter(([, c]) => isDue(c, t)).length

  const days = useMemo(() => {
    const out: { d: string; label: string; total: number }[] = []
    const dt = new Date()
    dt.setDate(dt.getDate() - (DAYS - 1))
    for (let i = 0; i < DAYS; i++) {
      const d = today(dt)
      const a = activity[d]
      out.push({
        d,
        label: dt.toLocaleDateString('fr-FR', { weekday: 'narrow' }),
        total: a ? a.read + a.recited + a.reviewed : 0,
      })
      dt.setDate(dt.getDate() + 1)
    }
    return out
  }, [activity])
  const max = Math.max(1, ...days.map((d) => d.total))

  const bySurah = useMemo(() => {
    const m = new Map<number, { learning: number; memorized: number }>()
    for (const [k, c] of cards) {
      const s = Number(k.split(':')[0])
      const e = m.get(s) ?? { learning: 0, memorized: 0 }
      if (isMemorized(c)) e.memorized++
      else e.learning++
      m.set(s, e)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [cards])

  const totals = Object.values(activity).reduce(
    (a, d) => ({ read: a.read + d.read, recited: a.recited + d.recited, reviewed: a.reviewed + d.reviewed }),
    { read: 0, recited: 0, reviewed: 0 },
  )

  return (
    <div className="screen">
      <h1 className="page-title">Progrès</h1>
      <div className="grid2">
        <div className="card tile">
          <Icon name="flame" fill />
          <strong>{streak(activity)}</strong>
          <span>jours d’affilée</span>
        </div>
        <div className="card tile">
          <Icon name="brain" />
          <strong>{memorized}</strong>
          <span>versets mémorisés · {((memorized / 6236) * 100).toFixed(1)} %</span>
        </div>
        <div className="card tile">
          <Icon name="review" />
          <strong>{due}</strong>
          <span>à réviser</span>
        </div>
        <div className="card tile">
          <Icon name="bookmark" />
          <strong>{bookmarks.length}</strong>
          <span>marque-pages</span>
        </div>
      </div>

      <h3 className="section-title">14 derniers jours</h3>
      <div className="card">
        <div className="bars" role="img" aria-label="Activité quotidienne">
          {days.map((d) => (
            <div key={d.d} className={`bar ${d.d === t ? 'today' : ''}`} title={`${d.d} : ${d.total}`}>
              <span style={{ height: `${(d.total / max) * 100}%` }} />
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        <p className="muted small">
          Au total : {totals.read} versets lus, {totals.recited} récités, {totals.reviewed} révisions.
        </p>
      </div>

      <h3 className="section-title">Mémorisation par sourate</h3>
      {bySurah.length === 0 ? (
        <p className="muted">Commencez à mémoriser une sourate pour suivre votre progression ici.</p>
      ) : (
        <ul className="list">
          {bySurah.map(([s, e]) => {
            const meta = idx?.[s - 1]
            if (!meta) return null
            return (
              <li key={s}>
                <a className="row" href={`#/s/${s}?m=memoriser`}>
                  <span className="num">{s}</span>
                  <div className="row-main">
                    <strong>{meta.tr}</strong>
                    <span className="muted">
                      {e.memorized} mémorisé{e.memorized > 1 ? 's' : ''} · {e.learning} en cours · {meta.verses} versets
                    </span>
                    <span className="minibar double">
                      <span style={{ width: `${(e.memorized / meta.verses) * 100}%` }} />
                      <span className="learning" style={{ width: `${(e.learning / meta.verses) * 100}%` }} />
                    </span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {bookmarks.length > 0 && (
        <>
          <h3 className="section-title">Marque-pages</h3>
          <div className="quick">
            {bookmarks.map((b) => {
              const [s, v] = b.split(':')
              return (
                <a key={b} className="chip" href={`#/s/${s}?v=${v}`}>
                  {idx?.[Number(s) - 1]?.tr} {v}
                </a>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
