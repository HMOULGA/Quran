export interface SurahMeta {
  id: number
  ar: string
  tr: string
  fr: string
  type: 'mecquoise' | 'médinoise'
  verses: number
  juz: number
  page: number
}

export interface Verse {
  n: number
  ar: string
  fr: string
  tr: string
  juz: number
  page: number
  sajda?: boolean
}

export type VerseKey = `${number}:${number}`

export const vkey = (s: number, v: number): VerseKey => `${s}:${v}`
export const parseKey = (k: string) => {
  const [s, v] = k.split(':').map(Number)
  return { s, v }
}
