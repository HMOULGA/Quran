import { describe, expect, it } from 'vitest'
import { align, buildExpected, heardWords, summarize } from './align'
import { normalizeHeard, variants } from './arabic'

const fatiha = [
  { n: 1, ar: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ' },
  { n: 2, ar: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ' },
  { n: 3, ar: 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ' },
  { n: 4, ar: 'مَٰلِكِ يَوۡمِ ٱلدِّينِ' },
  { n: 5, ar: 'إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ' },
  { n: 6, ar: 'ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ' },
  { n: 7, ar: 'صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ' },
]
const E = buildExpected(fatiha)

describe('normalisation', () => {
  it('gère l’alif suscrit dans les deux sens', () => {
    expect(variants('ٱلرَّحۡمَٰنِ')).toContain('الرحمن')
    expect(variants('ٱلۡكِتَٰبُ')).toContain('الكتاب')
    expect(normalizeHeard('الرَّحْمَنِ')).toBe('الرحمن')
  })
})

describe('alignement', () => {
  it('reconnaît une récitation parfaite en écriture courante', () => {
    const r = align(E, heardWords('بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين'))
    expect(r.position).toBe(13)
    expect(r.status.slice(0, 13).every((s) => s === 'ok')).toBe(true)
    expect(r.status[13]).toBe('pending')
  })

  it('accepte la transcription avec voyelles (Whisper Quran)', () => {
    const r = align(E, heardWords('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'))
    expect(summarize(r).accuracy).toBe(1)
    expect(r.position).toBe(8)
  })

  it('détecte un mot oublié', () => {
    const r = align(E, heardWords('بسم الله الرحمن الرحيم الحمد لله العالمين الرحمن الرحيم'))
    expect(r.status[6]).toBe('missed') // رَبِّ
    expect(r.status[7]).toBe('ok')
    expect(summarize(r).missed).toBe(1)
  })

  it('détecte un mot remplacé', () => {
    const r = align(E, heardWords('بسم الله الرحمن الرحيم الحمد لله رب السماوات'))
    expect(['wrong', 'close']).toContain(r.status[7])
  })

  it('ignore l’isti‘adha prononcée avant', () => {
    const r = align(E, heardWords('اعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم'))
    expect(r.status.slice(0, 4)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('gère un mot uthmani transcrit en deux mots', () => {
    const E2 = buildExpected([{ n: 21, ar: 'يَٰٓأَيُّهَا ٱلنَّاسُ ٱعۡبُدُواْ رَبَّكُمُ' }])
    const r = align(E2, heardWords('يا أيها الناس اعبدوا ربكم'))
    expect(r.status).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('tolère les graphies uthmani particulières', () => {
    const E3 = buildExpected([{ n: 3, ar: 'ٱلَّذِينَ يُؤۡمِنُونَ بِٱلۡغَيۡبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ' }])
    const r = align(E3, heardWords('الذين يؤمنون بالغيب ويقيمون الصلاة'))
    expect(r.status.every((s) => s === 'ok')).toBe(true)
  })
})
