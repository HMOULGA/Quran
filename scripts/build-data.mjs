// Génère les données du Coran utilisées par l'application (public/data).
// Sources : quran-json (texte uthmani QuranEnc, traduction FR, translittération Tanzil)
//           quran-meta (juz, pages du Mushaf de Médine, sajdas) – riwaya Hafs.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { findJuz, findPage, getAyahMeta, findAyahIdBySurah } from 'quran-meta/hafs'

const require = createRequire(import.meta.url)
const dist = require.resolve('quran-json/package.json').replace('package.json', 'dist/')
const fr = JSON.parse(readFileSync(dist + 'quran_fr.json', 'utf8'))
const tr = JSON.parse(readFileSync(dist + 'quran_transliteration.json', 'utf8'))

const out = new URL('../public/data/', import.meta.url)
rmSync(out, { recursive: true, force: true })
mkdirSync(new URL('s/', out), { recursive: true })

const index = []
const juzStarts = []
let total = 0
for (const s of fr) {
  const t = tr[s.id - 1]
  const verses = s.verses.map((v, i) => {
    const meta = getAyahMeta(findAyahIdBySurah(s.id, v.id))
    const row = {
      n: v.id,
      ar: v.text,
      fr: v.translation,
      tr: t.verses[i].transliteration,
      juz: findJuz(s.id, v.id),
      page: findPage(s.id, v.id),
    }
    if (meta.isSajdahAyah) row.sajda = true
    return row
  })
  for (const v of verses) if (!juzStarts[v.juz - 1]) juzStarts[v.juz - 1] = { juz: v.juz, surah: s.id, verse: v.n }
  total += verses.length
  index.push({
    id: s.id,
    ar: s.name,
    tr: s.transliteration,
    fr: s.translation,
    type: s.type === 'meccan' ? 'mecquoise' : 'médinoise',
    verses: s.total_verses,
    juz: verses[0].juz,
    page: verses[0].page,
  })
  writeFileSync(new URL(`s/${s.id}.json`, out), JSON.stringify(verses))
}
writeFileSync(new URL('index.json', out), JSON.stringify(index))
writeFileSync(new URL('juz.json', out), JSON.stringify(juzStarts))
if (total !== 6236) throw new Error('Nombre de versets inattendu : ' + total)
console.log(`OK : 114 sourates, ${total} versets`)
