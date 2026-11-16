import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import type { Recognizer, RecognizerCallbacks } from './index'

// Reconnaissance native Android, rendue continue.
//
// Le service Android s'arrête à chaque pause, et le plugin a deux particularités :
//  - l'événement « stopped » arrive AVANT le texte final de la phrase ;
//  - en cas d'erreur (silence, aucune correspondance), aucun événement n'est envoyé.
// On découpe donc la récitation en « sessions » numérotées : chaque résultat est rangé
// dans la session en cours, et une sentinelle vérifie régulièrement si le service
// s'est arrêté pour en relancer une nouvelle, après avoir laissé le temps au texte final d'arriver.
const WATCHDOG_MS = 300
const SETTLE_MS = 700 // délai laissé au résultat final après l'arrêt du service

export function createNativeRecognizer(cb: RecognizerCallbacks): Recognizer {
  let active = false
  let segments: string[] = []
  let session = -1
  let lastEvent = 0
  let starting = false
  let failures = 0
  let watchdog: ReturnType<typeof setInterval> | null = null
  const handles: PluginListenerHandle[] = []

  const emit = () => cb.onTranscript(segments.filter(Boolean).join(' '))

  async function newSession() {
    if (!active || starting) return
    starting = true
    session++
    segments[session] = ''
    lastEvent = Date.now()
    try {
      await SpeechRecognition.start({ language: 'ar-SA', maxResults: 1, partialResults: true, popup: false })
      failures = 0
    } catch {
      failures++
      if (failures > 10) {
        cb.onWarning?.('La reconnaissance Android répond mal. Essayez le moteur Whisper dans les Réglages.')
        failures = 0
      }
    } finally {
      starting = false
    }
  }

  async function tick() {
    if (!active || starting) return
    let listening = true
    try {
      listening = (await SpeechRecognition.isListening()).listening
    } catch {
      listening = false
    }
    if (!listening && Date.now() - lastEvent > SETTLE_MS) await newSession()
  }

  return {
    async start() {
      cb.onState('loading')
      const { available } = await SpeechRecognition.available()
      if (!available) {
        cb.onState('error', "La reconnaissance vocale d'Android n'est pas disponible sur cet appareil.")
        return
      }
      const perm = await SpeechRecognition.requestPermissions()
      if (perm.speechRecognition !== 'granted') {
        cb.onState('error', 'Autorisez l’accès au micro pour réciter.')
        return
      }
      segments = []
      session = -1
      failures = 0
      active = true
      handles.push(
        await SpeechRecognition.addListener('partialResults', (d) => {
          lastEvent = Date.now()
          const text = d.matches?.[0] ?? ''
          if (session < 0 || text === segments[session]) return
          segments[session] = text
          emit()
        }),
        await SpeechRecognition.addListener('listeningState', () => {
          lastEvent = Date.now()
        }),
      )
      cb.onInfo?.('Reconnaissance Android')
      cb.onState('listening')
      await newSession()
      watchdog = globalThis.setInterval(() => void tick(), WATCHDOG_MS)
    },
    async stop() {
      active = false
      if (watchdog != null) clearInterval(watchdog)
      watchdog = null
      try {
        await SpeechRecognition.stop()
      } catch {
        /* déjà arrêté */
      }
      // Laisser arriver le dernier résultat final
      await new Promise((r) => setTimeout(r, 500))
      emit()
      await Promise.all(handles.splice(0).map((h) => h.remove()))
      cb.onState('idle')
    },
  }
}
