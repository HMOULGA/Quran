// Moteurs de reconnaissance de la récitation.
//  - native   : reconnaissance vocale d'Android (plugin Capacitor), résultats en direct
//  - webspeech: API Web Speech du navigateur (Chrome, Edge)
//  - whisper  : modèle Whisper affiné sur le Coran, exécuté localement (transformers.js)
import { Capacitor } from '@capacitor/core'
import type { Engine } from '../store'
import { createNativeRecognizer } from './native'
import { createWebSpeechRecognizer } from './webspeech'
import { createWhisperRecognizer } from './whisper'

export type RecState = 'idle' | 'loading' | 'listening' | 'processing' | 'error'

export interface RecognizerCallbacks {
  /** Transcription cumulée depuis le début de la session. */
  onTranscript(text: string): void
  onState(state: RecState, message?: string): void
  onProgress?(percent: number, label: string): void
  /** Problème non bloquant : la récitation continue. */
  onWarning?(message: string): void
  /** Information sur le moteur utilisé (ex. « WebGPU q4 »). */
  onInfo?(label: string): void
  /** Niveau du micro entre 0 et 1, pour l'indicateur visuel. */
  onLevel?(level: number): void
}

export interface Recognizer {
  start(): Promise<void>
  stop(): Promise<void>
}

export const isAndroidNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export const isElectron = () => typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)

type SR = new () => SpeechRecognitionLike
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
export function webSpeechCtor(): SR | null {
  const w = globalThis as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function availableEngines(): Exclude<Engine, 'auto'>[] {
  const list: Exclude<Engine, 'auto'>[] = []
  if (isAndroidNative()) list.push('native')
  // Electron expose l'API Web Speech mais sans service de reconnaissance : on l'exclut.
  if (webSpeechCtor() && !isElectron() && !Capacitor.isNativePlatform()) list.push('webspeech')
  list.push('whisper')
  return list
}

export function resolveEngine(pref: Engine): Exclude<Engine, 'auto'> {
  const list = availableEngines()
  if (pref !== 'auto' && list.includes(pref)) return pref
  return list[0]
}

export const ENGINE_LABELS: Record<Engine, string> = {
  auto: 'Automatique',
  native: 'Reconnaissance Android (en direct)',
  webspeech: 'Reconnaissance du navigateur (en direct)',
  whisper: 'Whisper Coran, hors ligne (par segments)',
}

export function createRecognizer(engine: Exclude<Engine, 'auto'>, cb: RecognizerCallbacks, whisperModel: string): Recognizer {
  if (engine === 'native') return createNativeRecognizer(cb)
  if (engine === 'webspeech') return createWebSpeechRecognizer(cb)
  return createWhisperRecognizer(cb, whisperModel)
}
