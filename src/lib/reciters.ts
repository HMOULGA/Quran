// Récitations verset par verset hébergées par EveryAyah.com
export interface Reciter {
  id: string
  name: string
  style: string
}

export const RECITERS: Reciter[] = [
  { id: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy', style: 'Murattal' },
  { id: 'Husary_64kbps', name: 'Mahmoud Khalil Al-Husary', style: 'Murattal' },
  { id: 'Minshawy_Murattal_128kbps', name: 'Mohamed Siddiq Al-Minshawi', style: 'Murattal' },
  { id: 'Abdul_Basit_Murattal_64kbps', name: 'Abdul Basit Abdus-Samad', style: 'Murattal' },
  { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'Abdurrahman As-Sudais', style: 'Murattal' },
  { id: 'Saood_ash-Shuraym_128kbps', name: 'Saud Ash-Shuraim', style: 'Murattal' },
  { id: 'Abu_Bakr_Ash-Shaatree_128kbps', name: 'Abu Bakr Ash-Shatri', style: 'Murattal' },
  { id: 'Hani_Rifai_192kbps', name: 'Hani Ar-Rifai', style: 'Murattal' },
  { id: 'Mohammad_al_Tablaway_128kbps', name: 'Mohammad Al-Tablawi', style: 'Murattal' },
  { id: 'Ghamadi_40kbps', name: 'Saad Al-Ghamdi', style: 'Murattal' },
]

const pad = (n: number) => String(n).padStart(3, '0')

export function audioUrl(reciter: string, surah: number, verse: number): string {
  return `https://everyayah.com/data/${reciter}/${pad(surah)}${pad(verse)}.mp3`
}
