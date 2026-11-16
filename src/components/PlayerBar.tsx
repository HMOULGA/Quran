import { player, usePlayer } from '../lib/audio'
import { actions, useStore } from '../lib/store'
import { useIndex } from '../hooks'
import { RECITERS } from '../lib/reciters'
import { Icon } from './Icon'

export const RATES = [0.75, 1, 1.25, 1.5]

export function PlayerBar() {
  const p = usePlayer()
  const idx = useIndex()
  const rate = useStore((s) => s.settings.rate)
  if (!p.request) return null
  const meta = idx?.[p.request.surah - 1]
  const reciter = RECITERS.find((r) => r.id === p.request!.reciter)
  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    actions.setSettings({ rate: next })
    player.setRate(next)
  }
  const rep = p.request.repeatVerse
  return (
    <div className="playerbar" role="region" aria-label="Lecteur audio">
      <div className="pb-info">
        <a className="pb-title" href={`#/s/${p.request.surah}?v=${p.verse ?? 1}`}>
          {meta?.tr ?? ''} · {p.inBismillah ? 'Basmala' : `verset ${p.verse}`}
        </a>
        <div className="pb-sub">
          {reciter?.name}
          {rep !== 1 && ` · répétition ${p.verseRep}/${rep === 0 ? '∞' : rep}`}
          {p.error && <span className="pb-error"> · {p.error}</span>}
        </div>
      </div>
      <div className="pb-controls">
        <button className="icon-btn" onClick={player.prev} aria-label="Verset précédent">
          <Icon name="prev" size={18} />
        </button>
        <button
          className="icon-btn primary"
          onClick={() => (p.playing ? player.pause() : player.resume())}
          aria-label={p.playing ? 'Pause' : 'Lecture'}
        >
          {p.loading ? <span className="spinner" /> : <Icon name={p.playing ? 'pause' : 'play'} size={18} fill />}
        </button>
        <button className="icon-btn" onClick={player.next} aria-label="Verset suivant">
          <Icon name="next" size={18} />
        </button>
        <button className="chip small" onClick={cycleRate} aria-label="Vitesse">
          {rate}×
        </button>
        <button className="icon-btn" onClick={player.stop} aria-label="Fermer le lecteur">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}
