import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import type { Recognizer, RecognizerCallbacks } from './index'

// Le service Android s'arrête après un silence : on relance automatiquement
// et on concatène les segments terminés pour obtenir une transcription continue.
export function createNativeRecognizer(cb: RecognizerCallbacks): Recognizer {
  let active = false
  let done = ''
  let partial = ''
  const handles: PluginListenerHandle[] = []

  const emit = () => cb.onTranscript((done + ' ' + partial).trim())

  async function listen() {
    try {
      await SpeechRecognition.start({ language: 'ar-SA', maxResults: 1, partialResults: true, popup: false })
    } catch (e) {
      // « No match » ou délai dépassé : on relance tant que la session est active
      if (active) setTimeout(listen, 150)
      else cb.onState('error', String((e as Error)?.message ?? e))
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
      active = true
      handles.push(
        await SpeechRecognition.addListener('partialResults', (d) => {
          partial = d.matches?.[0] ?? ''
          emit()
        }),
        await SpeechRecognition.addListener('listeningState', (d) => {
          if (d.status === 'stopped') {
            if (partial) done = (done + ' ' + partial).trim()
            partial = ''
            emit()
            if (active) setTimeout(listen, 100)
          }
        }),
      )
      cb.onState('listening')
      await listen()
    },
    async stop() {
      active = false
      try {
        await SpeechRecognition.stop()
      } catch {
        /* déjà arrêté */
      }
      if (partial) done = (done + ' ' + partial).trim()
      partial = ''
      emit()
      await Promise.all(handles.splice(0).map((h) => h.remove()))
      cb.onState('idle')
    },
  }
}
