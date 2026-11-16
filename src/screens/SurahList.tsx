import { useEffect, useMemo, useState } from 'react'
import { useIndex } from '../hooks'
import { Icon } from '../components/Icon'
import { JUZ_NAMES, loadJuz } from '../lib/data'
import { useStore } from '../lib/store'
import { isMemorized } from '../lib/srs'
import type { SurahMeta } from '../lib/types'

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ'ʿʾ‘’-]/g, '')
    .replace(/\s+/g, '')

export function SurahList() {
  const idx = useIndex()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'sourates' | 'juz'>('sourates')
  const srs = useStore((s) => s.srs)
  const [juz, setJuz] = useState<{ juz: number; surah: number; verse: number }[]>([])
  useEffect(() => {
    loadJuz().then(setJuz)
  }, [])

  const memByS = useMemo(() => {
    const m: Record<number, number> = {}
    for (const [k, c] of Object.entries(srs)) if (isMemorized(c)) m[Number(k.split(':')[0])] = (m[Number(k.split(':')[0])] ?? 0) + 1
    return m
  }, [srs])

  const list = useMemo(() => {
    if (!idx) return []
    const f = fold(q)
    if (!f) return idx
    return idx.filter((s) => String(s.id) === q.trim() || fold(s.tr).includes(f) || fold(s.fr).includes(f) || s.ar.includes(q.trim()))
  }, [idx, q])

  if (!idx) return <div className="screen loading">Chargement…</div>

  return (
    <div className="screen">
      <h1 className="page-title">Le Saint Coran</h1>
      <div className="segmented">
        <button className={tab === 'sourates' ? 'on' : ''} onClick={() => setTab('sourates')}>
          Sourates
        </button>
        <button className={tab === 'juz' ? 'on' : ''} onClick={() => setTab('juz')}>
          Juz
        </button>
      </div>
      {tab === 'sourates' ? (
        <>
          <label className="search">
            <Icon name="search" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher : Yasin, la caverne, 36…"
              aria-label="Rechercher une sourate"
            />
          </label>
          <ul className="list">
            {list.map((s) => (
              <SurahRow key={s.id} s={s} mem={memByS[s.id] ?? 0} />
            ))}
            {list.length === 0 && <li className="empty">Aucune sourate ne correspond.</li>}
          </ul>
        </>
      ) : (
        <ul className="list">
          {JUZ_NAMES.map((name, i) => {
            const n = i + 1
            const start = juz[i]
            const startMeta = start ? idx[start.surah - 1] : null
            return (
              <li key={n}>
                <a className="row" href={start ? `#/s/${start.surah}?v=${start.verse}` : '#/sourates'}>
                  <span className="num">{n}</span>
                  <div className="row-main">
                    <strong>Juz {n}</strong>
                    <span className="muted">
                      {name}
                      {startMeta && ` · commence à ${startMeta.tr} ${start!.verse}`}
                    </span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SurahRow({ s, mem }: { s: SurahMeta; mem: number }) {
  return (
    <li>
      <a className="row" href={`#/s/${s.id}`}>
        <span className="num">{s.id}</span>
        <div className="row-main">
          <strong>{s.tr}</strong>
          <span className="muted">
            {s.fr} · {s.verses} versets · {s.type}
          </span>
          {mem > 0 && (
            <span className="minibar" title={`${mem}/${s.verses} versets mémorisés`}>
              <span style={{ width: `${(mem / s.verses) * 100}%` }} />
            </span>
          )}
        </div>
        <span className="arabic-name">{s.ar}</span>
      </a>
    </li>
  )
}
