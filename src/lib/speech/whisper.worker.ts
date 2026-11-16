/// <reference lib="webworker" />
// Exécute le modèle Whisper (affiné sur la récitation coranique) dans un Web Worker.
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = false

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loading: Promise<void> | null = null

async function hasWebGPU(): Promise<{ ok: boolean; f16: boolean }> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
  if (!gpu) return { ok: false, f16: false }
  try {
    const adapter = await gpu.requestAdapter()
    return { ok: !!adapter, f16: !!adapter?.features.has('shader-f16') }
  } catch {
    return { ok: false, f16: false }
  }
}

async function load(model: string) {
  const gpu = await hasWebGPU()
  const progress_callback = (p: { status: string; file?: string; progress?: number }) =>
    postMessage({ type: 'progress', status: p.status, file: p.file, progress: p.progress })
  try {
    if (gpu.ok) {
      asr = (await pipeline('automatic-speech-recognition', model, {
        device: 'webgpu',
        dtype: gpu.f16 ? 'fp16' : 'q4',
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline
      return
    }
  } catch {
    /* repli sur WebAssembly */
  }
  asr = (await pipeline('automatic-speech-recognition', model, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback,
  })) as AutomaticSpeechRecognitionPipeline
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      loading ??= load(msg.model)
      await loading
      postMessage({ type: 'ready' })
    } else if (msg.type === 'transcribe') {
      if (!asr) throw new Error('Modèle non chargé')
      const out = await asr(msg.audio as Float32Array, { language: 'arabic', task: 'transcribe' })
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
      postMessage({ type: 'result', id: msg.id, text })
    }
  } catch (err) {
    loading = null
    postMessage({ type: 'error', id: msg.id, message: String((err as Error)?.message ?? err) })
  }
}
