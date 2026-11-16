import { useRef, useState } from 'react'
import { actions, useStore, type Engine, type Theme } from '../lib/store'
import { RECITERS } from '../lib/reciters'
import { availableEngines, ENGINE_LABELS } from '../lib/speech'
import { RATES } from '../components/PlayerBar'

export function Settings() {
  const s = useStore((st) => st.settings)
  const set = actions.setSettings
  const engines: Engine[] = ['auto', ...availableEngines()]
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const exportData = () => {
    const blob = new Blob([actions.exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `itqan-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importData = async (f: File) => {
    try {
      actions.importData(await f.text())
      setMsg('Sauvegarde importée.')
    } catch (e) {
      setMsg('Import impossible : ' + (e as Error).message)
    }
  }

  return (
    <div className="screen settings">
      <h1 className="page-title">Réglages</h1>

      <section className="card">
        <h2>Écoute</h2>
        <label className="field">
          <span>Récitateur</span>
          <select value={s.reciter} onChange={(e) => set({ reciter: e.target.value })}>
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.style})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Vitesse</span>
          <select value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })}>
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        <label className="field switch">
          <span>Basmala avant le verset 1</span>
          <input type="checkbox" checked={s.playBismillah} onChange={(e) => set({ playBismillah: e.target.checked })} />
        </label>
      </section>

      <section className="card">
        <h2>Affichage</h2>
        <label className="field">
          <span>Taille du texte arabe : {s.fontSize}px</span>
          <input type="range" min={22} max={56} value={s.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
        </label>
        <p className="ar preview" lang="ar" dir="rtl">
          ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ
        </p>
        <label className="field switch">
          <span>Traduction française</span>
          <input type="checkbox" checked={s.showTranslation} onChange={(e) => set({ showTranslation: e.target.checked })} />
        </label>
        <label className="field switch">
          <span>Phonétique (translittération)</span>
          <input type="checkbox" checked={s.showTranslit} onChange={(e) => set({ showTranslit: e.target.checked })} />
        </label>
        <label className="field">
          <span>Thème</span>
          <select value={s.theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
            <option value="auto">Automatique</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Objectif et récitation</h2>
        <label className="field">
          <span>Objectif quotidien (versets lus ou récités)</span>
          <input
            type="number"
            min={1}
            max={500}
            value={s.dailyGoal}
            onChange={(e) => set({ dailyGoal: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="field">
          <span>Moteur de reconnaissance</span>
          <select value={s.engine} onChange={(e) => set({ engine: e.target.value as Engine })}>
            {engines.map((e) => (
              <option key={e} value={e}>
                {ENGINE_LABELS[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Modèle Whisper (Hugging Face)</span>
          <input value={s.whisperModel} onChange={(e) => set({ whisperModel: e.target.value.trim() })} spellCheck={false} />
        </label>
        <p className="muted small">
          Le modèle Whisper affiné sur la récitation coranique (env. 100 Mo) est téléchargé une seule fois, puis fonctionne hors ligne.
        </p>
      </section>

      <section className="card">
        <h2>Données</h2>
        <div className="row-buttons">
          <button className="btn" onClick={exportData}>
            Exporter ma progression
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importer
          </button>
          <button
            className="btn danger"
            onClick={() => confirmReset() && (actions.reset(), setMsg('Progression réinitialisée.'))}
          >
            Réinitialiser
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        {msg && <p className="muted small">{msg}</p>}
      </section>

      <section className="card about">
        <h2>À propos</h2>
        <p className="small">
          <strong>Itqan</strong> (إتقان, « la maîtrise ») est une application libre d’apprentissage du Coran.
        </p>
        <ul className="small muted">
          <li>Texte uthmani et traduction française : QuranEnc, via le paquet quran-json (CC BY-SA 4.0).</li>
          <li>Translittération : Tanzil.net.</li>
          <li>Juz, pages et sajdas : quran-meta (Mushaf de Médine, riwaya Hafs).</li>
          <li>Récitations : EveryAyah.com.</li>
          <li>Police : Amiri Quran (SIL Open Font License).</li>
          <li>Reconnaissance : modèle Whisper de Tarteel affiné sur EveryAyah (Apache 2.0).</li>
        </ul>
      </section>
    </div>
  )
}

// Pas de window.confirm dans Electron/Capacitor sans boîte native : on demande une double frappe
let armed = 0
function confirmReset() {
  const now = Date.now()
  if (now - armed < 3000) return true
  armed = now
  alertOnce()
  return false
}
function alertOnce() {
  const el = document.activeElement as HTMLButtonElement | null
  if (el) {
    const old = el.textContent
    el.textContent = 'Toucher encore pour confirmer'
    setTimeout(() => (el.textContent = old), 3000)
  }
}
