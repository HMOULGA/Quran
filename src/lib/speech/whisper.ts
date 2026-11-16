// Capture du micro, découpage par silences (détection d'activité vocale),
// puis transcription de chaque segment par Whisper dans un worker.
import type { Recognizer, RecognizerCallbacks } from './index'

const SR = 16000
const SILENCE_MS = 550 // silence qui termine un segment
const MIN_SPEECH_MS = 300
const MAX_SEGMENT_S = 12 // segments courts : résultats plus rapides
const PREROLL_CHUNKS = 3 // audio conservé juste avant le début de la parole

let worker: Worker | null = null
let ready: Promise<string> | null = null
let reqId = 0
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()
let progressCb: ((p: number, label: string) => void) | undefined

function getWorker(model: string): Promise<string> {
  if (!worker) {
    worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress' && m.status === 'progress' && typeof m.progress === 'number') {
        progressCb?.(m.progress, m.file ?? '')
      } else if (m.type === 'result') {
        pending.get(m.id)?.resolve(m.text)
        pending.delete(m.id)
      } else if (m.type === 'error' && m.id != null) {
        pending.get(m.id)?.reject(new Error(m.message))
        pending.delete(m.id)
      }
    }
  }
  if (!ready) {
    ready = new Promise<string>((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          worker!.removeEventListener('message', onMsg)
          resolve(e.data.backend ?? '')
        } else if (e.data.type === 'error' && e.data.id == null) {
          worker!.removeEventListener('message', onMsg)
          ready = null
          reject(new Error(e.data.message))
        }
      }
      worker!.addEventListener('message', onMsg)
      worker!.postMessage({ type: 'load', model })
    })
  }
  return ready
}

function transcribe(audio: Float32Array): Promise<string> {
  const id = ++reqId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ type: 'transcribe', id, audio }, [audio.buffer])
  })
}

/** Rééchantillonnage vers 16 kHz (moyenne par intervalle, suffisant pour la voix). */
export function downsample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === SR) return input
  const ratio = fromRate / SR
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let k = start; k < end; k++) sum += input[k]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

/** Whisper invente parfois des phrases sur du bruit : on ne garde que du texte arabe plausible. */
function clean(text: string): string {
  const t = text.replace(/[^؀-ۿ\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = t.split(' ')
  // Boucle de répétition typique d'une hallucination
  if (words.length > 6 && new Set(words).size <= 2) return ''
  return t
}

export function createWhisperRecognizer(cb: RecognizerCallbacks, model: string): Recognizer {
  let ctx: AudioContext | null = null
  let stream: MediaStream | null = null
  let node: ScriptProcessorNode | null = null
  let chunks: Float32Array[] = []
  let speechMs = 0
  let silenceMs = 0
  let texts: string[] = []
  let queue = Promise.resolve()
  let inflight = 0

  const emit = () => cb.onTranscript(texts.filter(Boolean).join(' '))

  function flush() {
    const hadSpeech = speechMs >= MIN_SPEECH_MS
    const parts = chunks
    chunks = []
    speechMs = 0
    silenceMs = 0
    if (!hadSpeech) return
    const len = parts.reduce((a, c) => a + c.length, 0)
    const buf = new Float32Array(len)
    let o = 0
    for (const c of parts) {
      buf.set(c, o)
      o += c.length
    }
    const slot = texts.push('') - 1
    inflight++
    cb.onState('processing')
    queue = queue
      .then(() => transcribe(buf))
      .then((t) => {
        texts[slot] = clean(t)
        emit()
      })
      .catch((e) => cb.onWarning?.('Transcription impossible : ' + e.message))
      .finally(() => {
        inflight--
        if (inflight === 0 && node) cb.onState('listening')
      })
  }

  return {
    async start() {
      texts = []
      chunks = []
      speechMs = silenceMs = 0
      progressCb = cb.onProgress
      cb.onState('loading')
      try {
        const backend = await getWorker(model)
        cb.onInfo?.(`Whisper Coran · ${backend}`)
      } catch (e) {
        cb.onState('error', 'Impossible de charger le modèle Whisper : ' + (e as Error).message)
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch {
        cb.onState('error', 'Autorisez l’accès au micro pour réciter (Paramètres Windows › Confidentialité › Microphone).')
        return
      }
      // Fréquence native du micro, puis rééchantillonnage : plus fiable que d'imposer 16 kHz
      ctx = new AudioContext()
      await ctx.resume()
      const rate = ctx.sampleRate
      const src = ctx.createMediaStreamSource(stream)
      node = ctx.createScriptProcessor(4096, 1, 1)
      let noise = 0.005
      let levelTick = 0
      node.onaudioprocess = (e) => {
        const data = downsample(new Float32Array(e.inputBuffer.getChannelData(0)), rate)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / Math.max(1, data.length))
        const ms = (data.length / SR) * 1000
        const threshold = Math.max(0.006, noise * 3)
        const speaking = rms > threshold
        if (!speaking) noise = noise * 0.97 + rms * 0.03 // bruit de fond
        if (++levelTick % 2 === 0) cb.onLevel?.(Math.min(1, rms / 0.15))
        chunks.push(data)
        if (speaking) {
          speechMs += ms
          silenceMs = 0
        } else {
          silenceMs += ms
          if (speechMs === 0 && chunks.length > PREROLL_CHUNKS) chunks.shift()
        }
        const total = chunks.reduce((a, c) => a + c.length, 0) / SR
        if ((speechMs > 0 && silenceMs >= SILENCE_MS) || total >= MAX_SEGMENT_S) flush()
      }
      src.connect(node)
      node.connect(ctx.destination)
      cb.onState('listening')
    },
    async stop() {
      if (node) {
        node.disconnect()
        node.onaudioprocess = null
      }
      node = null
      flush()
      stream?.getTracks().forEach((t) => t.stop())
      await ctx?.close()
      ctx = null
      cb.onLevel?.(0)
      await queue
      emit()
      cb.onState('idle')
    },
  }
}
