import { describe, expect, it, vi } from 'vitest'

// Faux plugin reproduisant le comportement réel du plugin Android :
//  - start() se résout tout de suite en mode résultats partiels ;
//  - « stopped » est envoyé AVANT le texte final ;
//  - après une erreur (silence), plus aucun événement.
const fake = vi.hoisted(() => {
  const listeners: Record<string, ((d: unknown) => void)[]> = {}
  const state = { listening: false, starts: 0 }
  return {
    state,
    emit(ev: string, d: unknown) {
      listeners[ev]?.forEach((f) => f(d))
    },
    plugin: {
      available: async () => ({ available: true }),
      requestPermissions: async () => ({ speechRecognition: 'granted' }),
      isListening: async () => ({ listening: state.listening }),
      start: async () => {
        state.starts++
        state.listening = true
      },
      stop: async () => {
        state.listening = false
      },
      addListener: async (ev: string, f: (d: unknown) => void) => {
        ;(listeners[ev] ??= []).push(f)
        return { remove: async () => void (listeners[ev] = listeners[ev].filter((g) => g !== f)) }
      },
    },
  }
})
vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: fake.plugin }))

import { createNativeRecognizer } from './native'
import { downsample } from './whisper'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('reconnaissance Android continue', () => {
  it('enchaîne les phrases sans doublon ni blocage', async () => {
    let transcript = ''
    const rec = createNativeRecognizer({ onTranscript: (t) => (transcript = t), onState: () => {} })
    await rec.start()
    expect(fake.state.starts).toBe(1)

    // Phrase 1 : partiels, arrêt, puis texte final en retard
    fake.emit('partialResults', { matches: ['الم'] })
    fake.emit('partialResults', { matches: ['الم ذلك'] })
    fake.state.listening = false
    fake.emit('listeningState', { status: 'stopped' })
    await wait(200)
    fake.emit('partialResults', { matches: ['الم ذلك الكتاب'] })
    expect(transcript).toBe('الم ذلك الكتاب')

    // La sentinelle relance une nouvelle session
    await wait(1200)
    expect(fake.state.starts).toBe(2)
    fake.emit('partialResults', { matches: ['لا ريب فيه'] })
    expect(transcript).toBe('الم ذلك الكتاب لا ريب فيه')

    // Erreur silencieuse (aucun événement) : relance quand même
    fake.state.listening = false
    await wait(1200)
    expect(fake.state.starts).toBe(3)
    fake.emit('partialResults', { matches: ['هدى للمتقين'] })

    await rec.stop()
    expect(transcript).toBe('الم ذلك الكتاب لا ريب فيه هدى للمتقين')
  }, 10000)
})

describe('rééchantillonnage', () => {
  it('passe de 48 kHz à 16 kHz', () => {
    const input = new Float32Array(4800).fill(0.5)
    const out = downsample(input, 48000)
    expect(out.length).toBe(1600)
    expect(out[10]).toBeCloseTo(0.5)
  })
})
