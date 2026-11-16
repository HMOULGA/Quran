import { useEffect, useRef, useState } from 'react'
import { useIndex, useSurah } from '../hooks'
import { navigate, type Mode } from '../router'
import { actions, today, useStore } from '../lib/store'
import { player, usePlayer } from '../lib/audio'
import { BISMILLAH, hasBismillahHeader } from '../lib/data'
import { vkey } from '../lib/types'
import { Icon } from '../components/Icon'
import { VerseCard } from '../components/VerseCard'
import { MemorizeVerse, type HideLevel } from '../components/MemorizeVerse'
import { ReciteView } from '../components/Recite'

const REPEATS = [1, 3, 5, 10, 0]
const seenToday = new Set<string>()

export function Reader({ route }: { route: { surah: number; verse?: number; mode: Mode } }) {
  const idx = useIndex()
  const verses = useSurah(route.surah)
  const settings = useStore((s) => s.settings)
  const bookmarks = useStore((s) => s.bookmarks)
  const srs = useStore((s) => s.srs)
  const p = usePlayer()
  const [repeat, setRepeat] = useState(1)
  const [hide, setHide] = useState<HideLevel>(2)
  const listRef = useRef<HTMLDivElement>(null)
  const meta = idx?.[route.surah - 1]
  const mode = route.mode

  const setMode = (m: Mode) => navigate({ name: 'reader', surah: route.surah, verse: route.verse, mode: m }, true)

  // Aller au verset demandé
  useEffect(() => {
    if (!verses || !route.verse || route.verse <= 1) return
    requestAnimationFrame(() => document.getElementById(`v${route.verse}`)?.scrollIntoView({ block: 'center' }))
  }, [verses, route.verse, mode])

  // Suivre le verset en cours de lecture
  const activeVerse = p.request?.surah === route.surah ? p.verse : null
  useEffect(() => {
    if (activeVerse && p.playing && mode !== 'reciter')
      document.getElementById(`v${activeVerse}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeVerse, p.playing, mode])

  // Versets lus : visibles au moins 2 s ; mémorise aussi la position de lecture
  useEffect(() => {
    if (!verses || mode === 'reciter') return
    const timers = new Map<Element, number>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.verse)
          if (e.isIntersecting) {
            timers.set(
              e.target,
              window.setTimeout(() => {
                actions.setLast(route.surah, n)
                const k = `${today()}:${route.surah}:${n}`
                if (!seenToday.has(k)) {
                  seenToday.add(k)
                  actions.logActivity('read')
                }
              }, 2000),
            )
          } else {
            clearTimeout(timers.get(e.target))
            timers.delete(e.target)
          }
        }
      },
      { threshold: 0.6 },
    )
    listRef.current?.querySelectorAll('[data-verse]').forEach((el) => obs.observe(el))
    return () => {
      obs.disconnect()
      timers.forEach((t) => clearTimeout(t))
    }
  }, [verses, mode, route.surah])

  const play = (from: number, to: number, repeatVerse = repeat) =>
    player.play({
      surah: route.surah,
      from,
      to,
      repeatVerse,
      repeatRange: 1,
      reciter: settings.reciter,
      rate: settings.rate,
      bismillah: settings.playBismillah,
    })

  if (!meta || !verses) return <div className="screen loading">Chargement…</div>

  return (
    <div className={`screen reader mode-${mode}`}>
      <header className="reader-head">
        <a className="icon-btn" href="#/sourates" aria-label="Retour aux sourates">
          <Icon name="back" />
        </a>
        <div className="reader-title">
          <h1>
            {meta.id}. {meta.tr}
          </h1>
          <span className="muted">
            {meta.fr} · {meta.verses} versets · {meta.type}
          </span>
        </div>
        <span className="arabic-name big">{meta.ar}</span>
      </header>

      <div className="segmented sticky">
        {(
          [
            ['lire', 'Lire', 'headphones'],
            ['memoriser', 'Mémoriser', 'eyeOff'],
            ['reciter', 'Réciter', 'mic'],
          ] as const
        ).map(([m, label, icon]) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            <Icon name={icon} size={16} /> {label}
          </button>
        ))}
      </div>

      {mode === 'lire' && (
        <div className="toolbar">
          <button className="btn primary" onClick={() => play(1, meta.verses)}>
            <Icon name="play" size={16} fill /> Écouter la sourate
          </button>
          <label className="select-inline" title="Nombre de répétitions de chaque verset">
            <Icon name="repeat" size={16} />
            <select value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? 'en boucle' : r === 1 ? '1 fois' : `${r} fois`}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`chip ${settings.showTranslation ? 'on' : ''}`}
            onClick={() => actions.setSettings({ showTranslation: !settings.showTranslation })}
          >
            Traduction
          </button>
          <button
            className={`chip ${settings.showTranslit ? 'on' : ''}`}
            onClick={() => actions.setSettings({ showTranslit: !settings.showTranslit })}
          >
            Phonétique
          </button>
        </div>
      )}

      {mode === 'memoriser' && (
        <div className="toolbar">
          <span className="muted small">Mots masqués :</span>
          {(
            [
              [0, 'aucun'],
              [1, 'un sur trois'],
              [2, 'deux sur trois'],
              [3, 'tous'],
            ] as const
          ).map(([lvl, label]) => (
            <button key={lvl} className={`chip ${hide === lvl ? 'on' : ''}`} onClick={() => setHide(lvl)}>
              {label}
            </button>
          ))}
          <p className="hint">Touchez un mot pour le révéler, puis notez-vous pour planifier la révision.</p>
        </div>
      )}

      {mode !== 'reciter' && hasBismillahHeader(meta.id) && (
        <p className="bismillah" lang="ar" dir="rtl">
          {BISMILLAH}
        </p>
      )}

      {mode === 'reciter' ? (
        <ReciteView surah={meta.id} verses={verses} startVerse={route.verse ?? 1} />
      ) : (
        <div className="verses" ref={listRef}>
          {verses.map((v) =>
            mode === 'lire' ? (
              <VerseCard
                key={v.n}
                surah={meta.id}
                v={v}
                active={activeVerse === v.n}
                bookmarked={bookmarks.includes(vkey(meta.id, v.n))}
                inReview={!!srs[vkey(meta.id, v.n)]}
                showTranslation={settings.showTranslation}
                showTranslit={settings.showTranslit}
                onPlay={() => play(v.n, meta.verses)}
                onLoop={() => play(v.n, v.n, 0)}
              />
            ) : (
              <MemorizeVerse
                key={v.n}
                surah={meta.id}
                v={v}
                level={hide}
                card={srs[vkey(meta.id, v.n)]}
                active={activeVerse === v.n}
                showTranslation={settings.showTranslation}
                onListen={() => play(v.n, v.n, 1)}
              />
            ),
          )}
        </div>
      )}

      <nav className="surah-nav">
        {meta.id > 1 ? (
          <a className="btn" href={`#/s/${meta.id - 1}${mode !== 'lire' ? `?m=${mode}` : ''}`}>
            ← {idx![meta.id - 2].tr}
          </a>
        ) : (
          <span />
        )}
        {meta.id < 114 && (
          <a className="btn" href={`#/s/${meta.id + 1}${mode !== 'lire' ? `?m=${mode}` : ''}`}>
            {idx![meta.id].tr} →
          </a>
        )}
      </nav>
    </div>
  )
}
