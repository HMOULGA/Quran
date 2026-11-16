import type { SurahMeta, Verse } from './types'

const base = import.meta.env.BASE_URL
let indexPromise: Promise<SurahMeta[]> | null = null
const surahCache = new Map<number, Promise<Verse[]>>()

export function loadIndex(): Promise<SurahMeta[]> {
  if (!indexPromise) {
    indexPromise = fetch(`${base}data/index.json`).then((r) => {
      if (!r.ok) throw new Error('Index introuvable')
      return r.json()
    })
  }
  return indexPromise
}

let juzPromise: Promise<{ juz: number; surah: number; verse: number }[]> | null = null
export function loadJuz() {
  juzPromise ??= fetch(`${base}data/juz.json`).then((r) => r.json())
  return juzPromise
}

export function loadSurah(id: number): Promise<Verse[]> {
  let p = surahCache.get(id)
  if (!p) {
    p = fetch(`${base}data/s/${id}.json`).then((r) => {
      if (!r.ok) throw new Error('Sourate introuvable')
      return r.json()
    })
    surahCache.set(id, p)
  }
  return p
}

/** Chiffres arabes-indiens pour les numéros de verset. */
export function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

export const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'

/** La basmala est affichée en tête de toutes les sourates sauf Al-Fatiha (où elle est le verset 1) et At-Tawba. */
export const hasBismillahHeader = (surah: number) => surah !== 1 && surah !== 9

export const JUZ_NAMES: string[] = [
  'Alif Lām Mīm', 'Sayaqūl', 'Tilka r-Rusul', 'Lan Tanālū', 'Wal-Muḥṣanāt', 'Lā Yuḥibbu llāh',
  'Wa Idhā Samiʿū', 'Wa Law Annanā', 'Qāla l-Malaʾ', 'Waʿlamū', 'Yaʿtadhirūn', 'Wa Mā Min Dābbah',
  'Wa Mā Ubarriʾu', 'Rubamā', 'Subḥāna lladhī', 'Qāla Alam', 'Iqtaraba', 'Qad Aflaḥa',
  'Wa Qāla lladhīna', 'Amman Khalaq', 'Utlu Mā Ūḥiya', 'Wa Man Yaqnut', 'Wa Mā Liya', 'Fa Man Aẓlam',
  'Ilayhi Yuraddu', 'Ḥā Mīm', 'Qāla Fa Mā Khaṭbukum', 'Qad Samiʿa llāh', 'Tabāraka lladhī', 'ʿAmma',
]
