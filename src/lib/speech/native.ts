import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import type { Recognizer, RecognizerCallbacks } from './index'

// Le service Android s'arrête après chaque silence : on le relance automatiquement
// et on concatène les segments terminés pour obtenir une transcription continue.
// Une seule relance peut être planifiée à la fois : sinon Android répond « occupé »
// (ERROR_RECOGNIZER_BUSY) et la reconnaissance se bloque.
export function createNativeRecognizer(cb: RecognizerCallbacks): Recognizer {
  let active = false
  let running = false
  let restartTimer: number | null = null
  let failures = 0
  let done = ''
  let partial = ''
  const handles: PluginListenerHandle[] = []

  const emit = () => cb.onTranscript((done + ' ' + partial).trim())

  const commitPartial = () => {
    if (partial) done = (done + ' ' + partial).trim()
    partial = ''
  }

  function scheduleRestart(delay: number) {
    if (!active || restartTimer != null) return
    restartTimer = window.setTimeout(() => {
      restartTimer = null
      void listen()
    }, delay)
  }

  async function listen() {
    if (!active || running) return
    running = true
    try {
      await SpeechRecognition.start({ language: 'ar-SA', maxResults: 1, partialResults: true, popup: false })
      failures = 0
    } catch {
      // « Aucune correspondance », délai dépassé ou service occupé : on réessaie en espaçant
      running = false
      failures++
      if (failures > 8) {
        active = false
        cb.onState('error', 'La reconnaissance vocale Android ne répond plus. Touchez le micro pour relancer.')
        return
      }
      scheduleRestart(Math.min(2000, 300 * failures))
    }
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
      done = ''
      partial = ''
      failures = 0
      active = true
      handles.push(
        await SpeechRecognition.addListener('partialResults', (d) => {
          const text = d.matches?.[0] ?? ''
          if (text === partial) return
          partial = text
          emit()
        }),
        await SpeechRecognition.addListener('listeningState', (d) => {
          if (d.status === 'stopped') {
            running = false
            commitPartial()
            emit()
            scheduleRestart(250)
          }
        }),
      )
      cb.onState('listening')
      await listen()
    },
    async stop() {
      active = false
      if (restartTimer != null) clearTimeout(restartTimer)
      restartTimer = null
      try {
        await SpeechRecognition.stop()
      } catch {
        /* déjà arrêté */
      }
      running = false
      commitPartial()
      emit()
      await Promise.all(handles.splice(0).map((h) => h.remove()))
      cb.onState('idle')
    },
  }
}
