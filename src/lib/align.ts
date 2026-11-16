// Alignement mot à mot entre la récitation entendue et le texte attendu.
// Programmation dynamique de type Needleman-Wunsch, avec :
//  - fusions 1:2 et 2:1 (ex. « يَٰٓأَيُّهَا » écrit en un mot mais transcrit « يا أيها ») ;
//  - lettres isolées (الٓمٓ) prononcées par leur nom : « alif lām mīm » = 3 mots entendus ;
//  - un cache de similarité par mot attendu, pour rester fluide pendant la reconnaissance en direct.
import { normalizeHeard, similarity, tokenize, variants } from './arabic'

export type WordStatus = 'ok' | 'close' | 'wrong' | 'missed' | 'pending'

export interface ExpectedWord {
  text: string // forme affichée (uthmani)
  verse: number
  index: number // position du mot dans le verset
  variants: string[]
  /** Noms des lettres pour les lettres isolées (muqaṭṭaʿāt), ex. ['الف', 'لام', 'ميم']. */
  spoken?: string[]
  /** Variantes de la concaténation avec le mot précédent (fusion 2:1). */
  joinPrev?: string[]
  cache: Map<string, number>
}

export interface AlignResult {
  status: WordStatus[]
  heardFor: (string | null)[]
  /** Nombre de mots attendus déjà couverts par la récitation. */
  position: number
  extras: string[]
}

export const OK = 0.75
export const CLOSE = 0.5

// Versets commençant par des lettres isolées (premier mot)
const MUQATTAAT = new Set([
  '2:1', '3:1', '7:1', '10:1', '11:1', '12:1', '13:1', '14:1', '15:1', '19:1', '20:1', '26:1', '27:1', '28:1',
  '29:1', '30:1', '31:1', '32:1', '36:1', '38:1', '40:1', '41:1', '42:1', '42:2', '43:1', '44:1', '45:1', '46:1',
  '50:1', '68:1',
])
const LETTER_NAMES: Record<string, string> = {
  ا: 'الف', ل: 'لام', م: 'ميم', ص: 'صاد', ر: 'را', ك: 'كاف', ه: 'ها', ي: 'يا',
  ع: 'عين', ط: 'طا', س: 'سين', ح: 'حا', ق: 'قاف', ن: 'نون',
}
const stripHamza = (s: string) => s.replace(/ء$/, '')

export function buildExpected(verses: { n: number; ar: string }[], surah = 0): ExpectedWord[] {
  const out: ExpectedWord[] = []
  for (const v of verses) {
    tokenize(v.ar).forEach((text, index) => {
      const w: ExpectedWord = { text, verse: v.n, index, variants: variants(text), cache: new Map() }
      if (index === 0 && MUQATTAAT.has(`${surah}:${v.n}`)) {
        const names = [...w.variants[0]].map((c) => LETTER_NAMES[c]).filter(Boolean)
        if (names.length === 1) w.variants.push(names[0])
        else if (names.length > 1) w.spoken = names
      }
      const prev = out[out.length - 1]
      if (prev) w.joinPrev = prev.variants.flatMap((a) => w.variants.map((b) => a + b))
      out.push(w)
    })
  }
  return out
}

export function heardWords(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normalizeHeard)
    .filter((w) => w.length > 0)
}

function sim(e: ExpectedWord, heard: string, kind = ''): number {
  const key = kind + heard
  let s = e.cache.get(key)
  if (s === undefined) {
    s = kind === 'j' ? similarity(e.joinPrev ?? [], heard) : similarity(e.variants, heard)
    e.cache.set(key, s)
  }
  return s
}

/** Similarité moyenne entre les noms de lettres attendus et k mots entendus (0 si l'un ne correspond pas). */
function spokenSim(e: ExpectedWord, heard: string[], j: number): number {
  const names = e.spoken!
  const k = names.length
  const key = 's' + heard.slice(j - k, j).join(' ')
  let s = e.cache.get(key)
  if (s === undefined) {
    let total = 0
    for (let t = 0; t < k; t++) {
      const v = similarity([stripHamza(names[t])], stripHamza(heard[j - k + t]))
      if (v < CLOSE) {
        total = 0
        break
      }
      total += v
    }
    s = total / k
    e.cache.set(key, s)
  }
  return s
}

type Op = 'm11' | 'm12' | 'm21' | 'mk' | 'del' | 'ins' | 'lead'

const MISS = -1
const EXTRA = -0.7
const LEAD = -0.2 // mots prononcés avant le début (isti'adha, basmala…)
// Un mot inconnu coûte plus cher en fin de récitation qu'un mot « en trop » :
// on ne fait jamais avancer la lecture sur un mot qui ne correspond pas.
const MISMATCH = -0.9

function matchScore(s: number): number {
  if (s >= OK) return 2
  if (s >= CLOSE) return 0.5
  return MISMATCH
}

export function align(expected: ExpectedWord[], heard: string[]): AlignResult {
  const n = expected.length
  const m = heard.length
  const W = m + 1
  const score = new Float64Array((n + 1) * W).fill(-Infinity)
  const op = new Array<Op>((n + 1) * W)
  score[0] = 0
  for (let j = 1; j <= m; j++) {
    score[j] = j * LEAD
    op[j] = 'lead'
  }
  for (let i = 1; i <= n; i++) {
    const e = expected[i - 1]
    const k = e.spoken?.length ?? 0
    for (let j = 0; j <= m; j++) {
      const at = i * W + j
      let best = score[(i - 1) * W + j] + MISS
      let bop: Op = 'del'
      if (j >= 1) {
        const ins = score[i * W + j - 1] + EXTRA
        if (ins > best) [best, bop] = [ins, 'ins']
        const m11 = score[(i - 1) * W + j - 1] + matchScore(sim(e, heard[j - 1]))
        if (m11 > best) [best, bop] = [m11, 'm11']
        if (i >= 2 && e.joinPrev && sim(e, heard[j - 1], 'j') >= 0.9) {
          const m21 = score[(i - 2) * W + j - 1] + 4.2
          if (m21 > best) [best, bop] = [m21, 'm21']
        }
      }
      if (j >= 2 && sim(e, heard[j - 2] + heard[j - 1]) >= 0.85) {
        const m12 = score[(i - 1) * W + j - 2] + 2.2
        if (m12 > best) [best, bop] = [m12, 'm12']
      }
      if (k >= 2 && j >= k) {
        const s = spokenSim(e, heard, j)
        if (s >= OK) {
          const mk = score[(i - 1) * W + j - k] + 2 + 0.3 * k
          if (mk > best) [best, bop] = [mk, 'mk']
        }
      }
      score[at] = best
      op[at] = bop
    }
  }

  // Le récitant peut s'arrêter n'importe où : on retient le meilleur préfixe du texte attendu.
  let end = 0
  for (let i = 1; i <= n; i++) if (score[i * W + m] > score[end * W + m]) end = i

  const status: WordStatus[] = new Array(n).fill('pending')
  const heardFor: (string | null)[] = new Array(n).fill(null)
  const extras: string[] = []
  let i = end
  let j = m
  while (i > 0 || j > 0) {
    const o = i === 0 ? 'lead' : op[i * W + j]
    if (o === 'lead') {
      j--
    } else if (o === 'ins') {
      extras.push(heard[j - 1])
      j--
    } else if (o === 'del') {
      status[i - 1] = 'missed'
      i--
    } else if (o === 'm11') {
      const s = sim(expected[i - 1], heard[j - 1])
      status[i - 1] = s >= OK ? 'ok' : s >= CLOSE ? 'close' : 'wrong'
      heardFor[i - 1] = heard[j - 1]
      i--
      j--
    } else if (o === 'm12') {
      status[i - 1] = 'ok'
      heardFor[i - 1] = heard[j - 2] + ' ' + heard[j - 1]
      i--
      j -= 2
    } else if (o === 'mk') {
      const k = expected[i - 1].spoken!.length
      status[i - 1] = 'ok'
      heardFor[i - 1] = heard.slice(j - k, j).join(' ')
      i--
      j -= k
    } else {
      status[i - 1] = status[i - 2] = 'ok'
      heardFor[i - 1] = heardFor[i - 2] = heard[j - 1]
      i -= 2
      j--
    }
  }
  return { status, heardFor, position: end, extras: extras.reverse() }
}

export interface Summary {
  total: number
  ok: number
  close: number
  wrong: number
  missed: number
  accuracy: number
}

export function summarize(r: AlignResult): Summary {
  const covered = r.status.slice(0, r.position)
  const count = (s: WordStatus) => covered.filter((x) => x === s).length
  const ok = count('ok')
  const total = covered.length
  return {
    total,
    ok,
    close: count('close'),
    wrong: count('wrong'),
    missed: count('missed'),
    accuracy: total ? ok / total : 0,
  }
}
