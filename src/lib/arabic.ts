// Normalisation du texte arabe pour comparer la récitation au texte uthmani.
// Le texte de référence est en graphie uthmani (alif suscrit, petits waw/ya, signes de pause),
// alors que la reconnaissance vocale renvoie en général l'écriture courante, sans voyelles.

const DAGGER_ALEF = /ٰ/g
// Voyelles, shadda, sukun, signes coraniques, tatweel, espaces fines, marques de hizb et de sajda
const MARKS = /[ؐ-ًؚ-ٟۖ-ۭـ ​-‏۞۩]/g
const NON_ARABIC = /[^ء-ي]/g

function letters(s: string): string {
  return s
    .replace(MARKS, '')
    .replace(/[ٱآأإٲٳ]/g, 'ا') // alif wasla, madda, hamza → alif
    .replace(/ى/g, 'ي') // alif maqsura
    .replace(/ة/g, 'ه') // ta marbuta
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(NON_ARABIC, '')
}

/** Forme normalisée d'un mot entendu (écriture courante). */
export function normalizeHeard(word: string): string {
  return letters(word.replace(DAGGER_ALEF, 'ا'))
}

/**
 * Variantes acceptables d'un mot uthmani : sans l'alif suscrit (ٱلرَّحۡمَٰنِ → الرحمن)
 * et avec l'alif suscrit écrit en entier (ٱلۡكِتَٰبُ → الكتاب).
 */
export function variants(word: string): string[] {
  const a = letters(word.replace(DAGGER_ALEF, ''))
  const b = letters(word.replace(DAGGER_ALEF, 'ا'))
  return a === b ? [a] : [a, b]
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((w) => letters(w).length > 0)
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Similarité entre 0 et 1 entre un mot entendu normalisé et les variantes du mot attendu. */
export function similarity(expectedVariants: string[], heard: string): number {
  let best = 0
  for (const e of expectedVariants) {
    if (!e.length || !heard.length) continue
    // Les mots très courts (و، في، من…) doivent correspondre exactement.
    if (Math.max(e.length, heard.length) <= 2) {
      best = Math.max(best, e === heard ? 1 : 0)
      continue
    }
    best = Math.max(best, 1 - levenshtein(e, heard) / Math.max(e.length, heard.length))
  }
  return best
}
