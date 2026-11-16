// Capture du micro à 16 kHz, découpage par silences (détection d'activité vocale simple),
// puis transcription de chaque segment par Whisper dans un worker.
import type { Recognizer, RecognizerCallbacks } from './index'

const SR = 16000
const SILENCE_MS = 700 // silence qui termine un segment
const MIN_SPEECH_MS = 400
const MAX_SEGMENT_S = 24 // Whisper traite au plus 30 s

let worker: Worker | null = null
let ready: Promise<void> | null = null
let reqId = 0
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>()
let progressCb: ((p: number, label: string) => void) | undefined

function getWorker(model: string): Promise<void> {
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
    ready = new Promise<void>((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        if (e.data.type === 'ready') {
          worker!.removeEventListener('message', onMsg)
          resolve()
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
    const len = chunks.reduce((a, c) => a + c.length, 0)
    const hadSpeech = speechMs >= MIN_SPEECH_MS
    const buf = new Float32Array(len)
    let o = 0
    for (const c of chunks) {
      buf.set(c, o)
      o += c.length
    }
    chunks = []
    speechMs = 0
    silenceMs = 0
    if (!hadSpeech) return
    const slot = texts.push('') - 1
    inflight++
    cb.onState('processing')
    queue = queue
      .then(() => transcribe(buf))
      .then((t) => {
        texts[slot] = t.trim()
        emit()
      })
      .catch((e) => cb.onState('error', e.message))
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
        await getWorker(model)
      } catch (e) {
        cb.onState('error', 'Impossible de charger le modèle Whisper : ' + (e as Error).message)
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        })
      } catch {
        cb.onState('error', 'Autorisez l’accès au micro pour réciter.')
        return
      }
      ctx = new AudioContext({ sampleRate: SR })
      const src = ctx.createMediaStreamSource(stream)
      node = ctx.createScriptProcessor(4096, 1, 1)
      let noise = 0.01
      node.onaudioprocess = (e) => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0))
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length)
        const ms = (data.length / SR) * 1000
        const speaking = rms > Math.max(0.012, noise * 2.5)
        if (!speaking) noise = noise * 0.95 + rms * 0.05 // estimation du bruit de fond
        chunks.push(data)
        if (speaking) {
          speechMs += ms
          silenceMs = 0
        } else {
          silenceMs += ms
          // Pas encore de parole : on ne garde qu'une courte amorce
          if (speechMs === 0 && chunks.length > 3) chunks.shift()
        }
        const total = chunks.length * ms
        if ((speechMs > 0 && silenceMs >= SILENCE_MS) || total >= MAX_SEGMENT_S * 1000) flush()
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
      flush()
      node = null
      stream?.getTracks().forEach((t) => t.stop())
      await ctx?.close()
      ctx = null
      await queue
      emit()
      cb.onState('idle')
    },
  }
}
