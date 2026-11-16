// Révision espacée, variante simplifiée de SM-2.
// Note : 0 = oublié, 3 = difficile, 4 = bien, 5 = facile.
export type Grade = 0 | 3 | 4 | 5

export interface Card {
  ef: number // facteur de facilité
  interval: number // jours
  reps: number // réussites consécutives
  due: string // AAAA-MM-JJ
  last: string
  lapses: number
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function review(card: Card | undefined, grade: Grade, todayStr: string): Card {
  const c: Card = card ? { ...card } : { ef: 2.5, interval: 0, reps: 0, due: todayStr, last: todayStr, lapses: 0 }
  if (grade < 3) {
    c.reps = 0
    c.interval = 1
    c.lapses += 1
  } else {
    c.reps += 1
    if (c.reps === 1) c.interval = grade === 5 ? 3 : 1
    else if (c.reps === 2) c.interval = grade === 3 ? 3 : 6
    else c.interval = Math.round(c.interval * c.ef * (grade === 3 ? 0.8 : grade === 5 ? 1.3 : 1))
  }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
  c.last = todayStr
  c.due = addDays(todayStr, c.interval)
  return c
}

export const isDue = (c: Card, todayStr: string) => c.due <= todayStr

/** Un verset est considéré « mémorisé » après deux révisions réussies d'affilée. */
export const isMemorized = (c: Card | undefined) => !!c && c.reps >= 2
