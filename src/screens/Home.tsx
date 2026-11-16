import { useIndex } from '../hooks'
import { Icon } from '../components/Icon'
import { streak, today, useStore } from '../lib/store'
import { isDue, isMemorized } from '../lib/srs'

const QUICK = [
  { id: 1, label: 'Al-Fatiha' },
  { id: 18, label: 'Al-Kahf' },
  { id: 36, label: 'Ya-Sin' },
  { id: 67, label: 'Al-Mulk' },
  { id: 78, label: 'Juz ʿAmma' },
]

export function Home() {
  const idx = useIndex()
  const last = useStore((s) => s.last)
  const activity = useStore((s) => s.activity)
  const srs = useStore((s) => s.srs)
  const goal = useStore((s) => s.settings.dailyGoal)
  const t = today()
  const day = activity[t] ?? { read: 0, reviewed: 0, recited: 0 }
  const doneToday = day.read + day.recited
  const pct = Math.min(1, doneToday / Math.max(1, goal))
  const due = Object.values(srs).filter((c) => isDue(c, t)).length
  const memorized = Object.values(srs).filter(isMemorized).length
  const s = streak(activity)
  const lastMeta = last && idx ? idx[last.surah - 1] : null
  const hour = new Date().getHours()

  return (
    <div className="screen">
      <header className="hero">
        <div>
          <p className="eyebrow">{hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour'}</p>
          <h1>As-salāmu ʿalaykum</h1>
        </div>
        <div className="streak" title="Jours consécutifs">
          <Icon name="flame" size={18} fill />
          <span>{s}</span>
        </div>
      </header>

      <section className="goal card">
        <div className="ring" style={{ ['--p' as string]: pct }}>
          <span>
            {doneToday}
            <small>/{goal}</small>
          </span>
        </div>
        <div className="goal-text">
          <h2>Objectif du jour</h2>
          <p>
            {pct >= 1
              ? 'Objectif atteint, qu’Allah vous récompense.'
              : `${goal - doneToday} verset${goal - doneToday > 1 ? 's' : ''} à lire ou réciter aujourd’hui.`}
          </p>
        </div>
      </section>

      {lastMeta && last && (
        <a className="card continue" href={`#/s/${last.surah}?v=${last.verse}`}>
          <div>
            <p className="eyebrow">Reprendre la lecture</p>
            <h2>
              {lastMeta.tr} <span className="muted">· verset {last.verse}</span>
            </h2>
            <p className="muted">{lastMeta.fr}</p>
          </div>
          <span className="arabic-name">{lastMeta.ar}</span>
        </a>
      )}

      <div className="grid2">
        <a className="card tile" href="#/revision">
          <Icon name="review" />
          <strong>{due}</strong>
          <span>verset{due > 1 ? 's' : ''} à réviser</span>
        </a>
        <a className="card tile" href="#/progres">
          <Icon name="brain" />
          <strong>{memorized}</strong>
          <span>verset{memorized > 1 ? 's' : ''} mémorisé{memorized > 1 ? 's' : ''}</span>
        </a>
      </div>

      <h3 className="section-title">Accès rapide</h3>
      <div className="quick">
        {QUICK.map((q) => (
          <a key={q.id} className="chip" href={`#/s/${q.id}`}>
            {q.label}
          </a>
        ))}
      </div>

      <h3 className="section-title">Trois façons d’apprendre</h3>
      <div className="modes">
        <a className="card mode" href={`#/s/${last?.surah ?? 1}`}>
          <Icon name="headphones" />
          <div>
            <strong>Écouter et lire</strong>
            <p className="muted">Suivez un récitateur verset par verset, répétez autant que nécessaire.</p>
          </div>
        </a>
        <a className="card mode" href={`#/s/${last?.surah ?? 1}?m=memoriser`}>
          <Icon name="eyeOff" />
          <div>
            <strong>Mémoriser</strong>
            <p className="muted">Masquez progressivement les mots et testez-vous avec la révision espacée.</p>
          </div>
        </a>
        <a className="card mode" href={`#/s/${last?.surah ?? 1}?m=reciter`}>
          <Icon name="mic" />
          <div>
            <strong>Réciter</strong>
            <p className="muted">Récitez au micro : l’application suit votre lecture et signale les erreurs.</p>
          </div>
        </a>
      </div>
    </div>
  )
}
