// Alignement mot à mot entre la récitation entendue et le texte attendu.
// Programmation dynamique de type Needleman-Wunsch, avec fusions 1:2 et 2:1
// (ex. « يَٰٓأَيُّهَا » écrit en un mot mais transcrit « يا أيها »).
import { normalizeHeard, similarity, tokenize, variants } from './arabic'

export type WordStatus = 'ok' | 'close' | 'wrong' | 'missed' | 'pending'

export interface ExpectedWord {
  text: string // forme affichée (uthmani)
  verse: number
  index: number // position du mot dans le verset
  variants: string[]
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

export function buildExpected(verses: { n: number; ar: string }[]): ExpectedWord[] {
  const out: ExpectedWord[] = []
  for (const v of verses) {
    tokenize(v.ar).forEach((text, index) => out.push({ text, verse: v.n, index, variants: variants(text) }))
  }
  return out
}

export function heardWords(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normalizeHeard)
    .filter((w) => w.length > 0)
}

type Op = 'm11' | 'm12' | 'm21' | 'del' | 'ins' | 'lead'

const MISS = -1
const EXTRA = -0.7
const LEAD = -0.2 // mots prononcés avant le début (isti'adha, basmala…)

function matchScore(sim: number): number {
  if (sim >= OK) return 2
  if (sim >= CLOSE) return 0.5
  return -0.5
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
    for (let j = 0; j <= m; j++) {
      const at = i * W + j
      let best = score[(i - 1) * W + j] + MISS
      let bop: Op = 'del'
      if (j >= 1) {
        const ins = score[i * W + j - 1] + EXTRA
        if (ins > best) [best, bop] = [ins, 'ins']
        const m11 = score[(i - 1) * W + j - 1] + matchScore(similarity(e.variants, heard[j - 1]))
        if (m11 > best) [best, bop] = [m11, 'm11']
      }
      if (j >= 2) {
        const sim = similarity(e.variants, heard[j - 2] + heard[j - 1])
        if (sim >= 0.85) {
          const m12 = score[(i - 1) * W + j - 2] + 2.2
          if (m12 > best) [best, bop] = [m12, 'm12']
        }
      }
      if (i >= 2 && j >= 1) {
        const prev = expected[i - 2]
        const joined = prev.variants.flatMap((a) => e.variants.map((b) => a + b))
        if (similarity(joined, heard[j - 1]) >= 0.9) {
          const m21 = score[(i - 2) * W + j - 1] + 4.2
          if (m21 > best) [best, bop] = [m21, 'm21']
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
      const sim = similarity(expected[i - 1].variants, heard[j - 1])
      status[i - 1] = sim >= OK ? 'ok' : sim >= CLOSE ? 'close' : 'wrong'
      heardFor[i - 1] = heard[j - 1]
      i--
      j--
    } else if (o === 'm12') {
      status[i - 1] = 'ok'
      heardFor[i - 1] = heard[j - 2] + ' ' + heard[j - 1]
      i--
      j -= 2
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
