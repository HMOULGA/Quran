import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Verse } from '../lib/types'
import { vkey } from '../lib/types'
import { align, buildExpected, heardWords, summarize, type WordStatus } from '../lib/align'
import { createRecognizer, ENGINE_LABELS, resolveEngine, type Recognizer, type RecState } from '../lib/speech'
import { actions, useStore } from '../lib/store'
import { player } from '../lib/audio'
import { AyahNumber } from './VerseCard'
import { Icon } from './Icon'

const STATUS_LABEL: Record<WordStatus, string> = {
  ok: 'correct',
  close: 'approximatif',
  wrong: 'erreur',
  missed: 'oublié',
  pending: '',
}

export function ReciteView({ surah, verses, startVerse }: { surah: number; verses: Verse[]; startVerse: number }) {
  const settings = useStore((s) => s.settings)
  const engine = resolveEngine(settings.engine)
  const [start, setStart] = useState(Math.min(Math.max(1, startVerse), verses.length))
  const [hideText, setHideText] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [state, setState] = useState<RecState>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState(false)
  const [devText, setDevText] = useState('')
  const rec = useRef<Recognizer | null>(null)

  const slice = useMemo(() => verses.filter((v) => v.n >= start), [verses, start])
  const expected = useMemo(() => buildExpected(slice), [slice])
  const deferred = useDeferredValue(transcript)

  const result = useMemo(() => {
    const heard = heardWords(deferred)
    // Fenêtre glissante : inutile d'aligner toute la sourate sur quelques mots entendus
    const n = Math.min(expected.length, Math.max(150, Math.ceil(heard.length * 1.3) + 80))
    const r = align(expected.slice(0, n), heard)
    const status = [...r.status, ...new Array(expected.length - n).fill('pending')] as WordStatus[]
    return { ...r, status }
  }, [expected, deferred])

  const summary = summarize(result)
  const listening = state === 'listening' || state === 'processing'

  // Suivre la position de lecture à l'écran
  useEffect(() => {
    if (!listening || result.position === 0) return
    const w = expected[Math.min(result.position, expected.length - 1)]
    document.getElementById(`v${w.verse}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [result.position, listening, expected])

  useEffect(() => () => void rec.current?.stop(), [])

  const reset = () => {
    setTranscript('')
    setFinished(false)
    setSaved(false)
    setMessage('')
  }

  const startRec = async () => {
    reset()
    player.stop()
    rec.current = createRecognizer(
      engine,
      {
        onTranscript: setTranscript,
        onState: (s, m) => {
          setState(s)
          if (m) setMessage(m)
          if (s !== 'loading') setProgress(null)
        },
        onProgress: (p) => setProgress(p),
      },
      settings.whisperModel,
    )
    await rec.current.start()
  }

  const stopRec = async () => {
    await rec.current?.stop()
    rec.current = null
    setFinished(true)
  }

  // Une fois terminé : verset par verset, mots couverts et nombre d'erreurs
  const perVerse = useMemo(() => {
    const out = new Map<number, { total: number; ok: number; covered: boolean }>()
    expected.forEach((w, i) => {
      const e = out.get(w.verse) ?? { total: 0, ok: 0, covered: true }
      e.total++
      if (result.status[i] === 'ok') e.ok++
      if (i >= result.position) e.covered = false
      out.set(w.verse, e)
    })
    return out
  }, [expected, result])

  const recitedVerses = [...perVerse.entries()].filter(([, e]) => e.covered)

  useEffect(() => {
    if (finished && recitedVerses.length) actions.logActivity('recited', recitedVerses.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const saveToReview = () => {
    for (const [n, e] of recitedVerses) {
      const ratio = e.ok / e.total
      actions.grade(vkey(surah, n), ratio === 1 ? 4 : ratio >= 0.8 ? 3 : 0)
    }
    setSaved(true)
  }

  let wi = 0
  return (
    <div className="recite">
      <div className="toolbar">
        <label className="select-inline">
          Commencer au verset
          <select value={start} disabled={listening} onChange={(e) => (setStart(Number(e.target.value)), reset())}>
            {verses.map((v) => (
              <option key={v.n} value={v.n}>
                {v.n}
              </option>
            ))}
          </select>
        </label>
        <button className={`chip ${hideText ? 'on' : ''}`} onClick={() => setHideText(!hideText)}>
          <Icon name={hideText ? 'eyeOff' : 'eye'} size={14} /> {hideText ? 'Texte masqué' : 'Texte visible'}
        </button>
        <span className="muted small">Moteur : {ENGINE_LABELS[engine]}</span>
      </div>
      {hideText && <p className="hint">Les mots apparaissent au fur et à mesure que vous les récitez correctement.</p>}

      <div className="verses">
        {slice.map((v) => (
          <article key={v.n} id={`v${v.n}`} className="verse recite-verse">
            <div className="verse-head">
              <span className="vref">
                {surah}:{v.n}
              </span>
            </div>
            <p className="ar" lang="ar" dir="rtl">
              {v.ar.split(/\s+/).map((w, i) => {
                const idx = wi++
                const s = result.status[idx] ?? 'pending'
                const cursor = listening && idx === result.position
                const masked = hideText && s === 'pending'
                return (
                  <Fragment key={i}>
                  {i > 0 && ' '}
                  <span
                    className={`word st-${s}${cursor ? ' cursor' : ''}${masked ? ' masked' : ''}`}
                    title={result.heardFor[idx] ? `entendu : ${result.heardFor[idx]}` : STATUS_LABEL[s]}
                  >
                    {w}
                  </span>
                  </Fragment>
                )
              })}{' '}
              <AyahNumber n={v.n} />
            </p>
          </article>
        ))}
      </div>

      <div className="recite-panel">
        {finished && summary.total > 0 && (
          <div className="summary">
            <div className="score">{Math.round(summary.accuracy * 100)}%</div>
            <div>
              <strong>
                {summary.ok}/{summary.total} mots corrects · {recitedVerses.length} verset{recitedVerses.length > 1 ? 's' : ''}
              </strong>
              <p className="muted small">
                {summary.missed} oublié{summary.missed > 1 ? 's' : ''} · {summary.wrong + summary.close} erreur
                {summary.wrong + summary.close > 1 ? 's' : ''}
              </p>
            </div>
            {recitedVerses.length > 0 && (
              <button className="btn" disabled={saved} onClick={saveToReview}>
                {saved ? <><Icon name="check" size={16} /> Enregistré</> : 'Noter dans la révision'}
              </button>
            )}
          </div>
        )}
        {finished && summary.total === 0 && <p className="muted small">Aucune récitation détectée. Réessayez plus près du micro.</p>}
        {state === 'error' && <p className="error">{message}</p>}
        {state === 'loading' && (
          <p className="muted small">
            {engine === 'whisper'
              ? `Chargement du modèle (une seule fois)${progress != null ? ` : ${Math.round(progress)}%` : '…'}`
              : 'Préparation…'}
          </p>
        )}
        <div className="panel-row">
          <div className="legend small">
            <span className="st-ok">correct</span>
            <span className="st-close">approximatif</span>
            <span className="st-wrong">erreur</span>
            <span className="st-missed">oublié</span>
          </div>
          <button
            className={`mic ${listening ? 'live' : ''}`}
            onClick={listening ? stopRec : startRec}
            disabled={state === 'loading'}
            aria-label={listening ? 'Arrêter' : 'Commencer à réciter'}
          >
            <Icon name={listening ? 'stop' : 'mic'} size={28} fill={listening} />
          </button>
          <div className="panel-state small">
            {listening ? (state === 'processing' ? 'Analyse…' : 'À l’écoute…') : finished ? 'Terminé' : 'Touchez pour réciter'}
          </div>
        </div>
        {import.meta.env.DEV && (
          <form
            className="devbox"
            onSubmit={(e) => {
              e.preventDefault()
              setTranscript(devText)
              setFinished(true)
            }}
          >
            <input value={devText} onChange={(e) => setDevText(e.target.value)} placeholder="(dev) transcription simulée" dir="rtl" />
          </form>
        )}
      </div>
    </div>
  )
}
