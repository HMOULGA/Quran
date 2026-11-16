import { type Recognizer, type RecognizerCallbacks, type SpeechRecognitionLike, webSpeechCtor } from './index'

export function createWebSpeechRecognizer(cb: RecognizerCallbacks): Recognizer {
  let rec: SpeechRecognitionLike | null = null
  let active = false
  let done = ''

  function begin() {
    const Ctor = webSpeechCtor()
    if (!Ctor) {
      cb.onState('error', 'Ce navigateur ne propose pas la reconnaissance vocale.')
      return
    }
    rec = new Ctor()
    rec.lang = 'ar-SA'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    let sessionFinal = ''
    rec.onresult = (e) => {
      let interim = ''
      sessionFinal = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) sessionFinal += ' ' + r[0].transcript
        else interim += ' ' + r[0].transcript
      }
      cb.onTranscript((done + ' ' + sessionFinal + ' ' + interim).replace(/\s+/g, ' ').trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        active = false
        cb.onState('error', 'Autorisez l’accès au micro pour réciter.')
      } else if (e.error === 'network') {
        active = false
        cb.onState('error', 'La reconnaissance du navigateur nécessite une connexion Internet.')
      }
    }
    rec.onend = () => {
      done = (done + ' ' + sessionFinal).trim()
      if (active) begin() // Chrome coupe la session après un silence prolongé
    }
    rec.start()
  }

  return {
    async start() {
      done = ''
      active = true
      begin()
      cb.onState('listening')
    },
    async stop() {
      active = false
      rec?.stop()
      cb.onState('idle')
    },
  }
}
