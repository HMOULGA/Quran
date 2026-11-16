/// <reference lib="webworker" />
// Exécute le modèle Whisper (affiné sur la récitation coranique) dans un Web Worker.
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = false

let asr: AutomaticSpeechRecognitionPipeline | null = null
let loading: Promise<void> | null = null
let backend = ''
// Certains exports n'acceptent pas l'option de langue : on la retire si elle provoque une erreur
let withLanguage = true

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

// Les exports fp16 du modèle Coran échouent avec ONNX Runtime (erreur de type float16/float).
// On essaie donc plusieurs configurations, de la plus rapide à la plus sûre.
type Dtype = 'q4' | 'q8' | 'fp32'
async function load(model: string) {
  const gpu = await hasWebGPU()
  const attempts: { device: 'webgpu' | 'wasm'; dtype: Dtype }[] = [
    ...(gpu.ok ? [{ device: 'webgpu' as const, dtype: 'q4' as const }] : []),
    { device: 'wasm', dtype: 'q8' },
    { device: 'wasm', dtype: 'fp32' },
  ]
  const progress_callback = (p: { status: string; file?: string; progress?: number }) =>
    postMessage({ type: 'progress', status: p.status, file: p.file, progress: p.progress })
  const errors: string[] = []
  for (const a of attempts) {
    try {
      asr = (await pipeline('automatic-speech-recognition', model, {
        device: a.device,
        dtype: { encoder_model: a.dtype, decoder_model_merged: a.dtype },
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline
      backend = `${a.device === 'webgpu' ? 'WebGPU' : 'processeur'} ${a.dtype}`
      return
    } catch (e) {
      errors.push(`${a.device}/${a.dtype} : ${String((e as Error)?.message ?? e).slice(0, 160)}`)
    }
  }
  throw new Error(errors.join(' | '))
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      loading ??= load(msg.model)
      await loading
      postMessage({ type: 'ready', backend })
    } else if (msg.type === 'transcribe') {
      if (!asr) throw new Error('Modèle non chargé')
      const audio = msg.audio as Float32Array
      let out
      if (withLanguage) {
        try {
          out = await asr(audio, { language: 'arabic', task: 'transcribe' })
        } catch {
          withLanguage = false
        }
      }
      out ??= await asr(audio)
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
      postMessage({ type: 'result', id: msg.id, text })
    }
  } catch (err) {
    loading = null
    postMessage({ type: 'error', id: msg.id, message: String((err as Error)?.message ?? err) })
  }
}
