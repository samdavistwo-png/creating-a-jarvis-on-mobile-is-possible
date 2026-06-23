// JACK — Voice I/O (speech recognition + speech synthesis)
//
// Uses the browser's built-in Web Speech API — no servers, no keys, works on
// Chrome / Edge / most Android browsers and Safari. Supports English (en-IN)
// and Tamil (ta-IN) for BOTH listening and speaking, so JACK can hear you in
// English or Tamil and talk back in the same language.

export type Lang = 'en' | 'ta'

export const LANGS: { id: Lang; label: string; code: string; speakCode: string }[] = [
  { id: 'en', label: 'English', code: 'en-IN', speakCode: 'en-IN' },
  { id: 'ta', label: 'தமிழ்', code: 'ta-IN', speakCode: 'ta-IN' },
]

export function langCode(lang: Lang): string {
  return LANGS.find((l) => l.id === lang)?.code ?? 'en-IN'
}

// ---- Speech recognition (speech → text) ----

type SR = typeof window extends never ? never : any

function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function sttSupported(): boolean {
  return !!getSpeechRecognition()
}

export interface Recognizer {
  start: () => void
  stop: () => void
}

/** Create a one-shot recognizer for the given language. Calls onResult with the
 * final transcript, then onEnd. Returns null if the browser has no STT. */
export function createRecognizer(
  lang: Lang,
  handlers: { onResult: (text: string) => void; onEnd?: () => void; onError?: (err: string) => void },
): Recognizer | null {
  const Ctor = getSpeechRecognition()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = langCode(lang)
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.continuous = false

  rec.onresult = (e: any) => {
    const transcript = Array.from(e.results)
      .map((r: any) => r[0]?.transcript ?? '')
      .join(' ')
      .trim()
    if (transcript) handlers.onResult(transcript)
  }
  rec.onerror = (e: any) => handlers.onError?.(e?.error || 'speech-error')
  rec.onend = () => handlers.onEnd?.()

  return {
    start: () => {
      try { rec.start() } catch (err) { handlers.onError?.(String(err)) }
    },
    stop: () => {
      try { rec.stop() } catch { /* ignore */ }
    },
  }
}

// ---- Speech synthesis (text → speech) ----

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Strip markdown / emoji / symbols so JACK speaks clean prose. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, ' code snippet ')
    .replace(/[#>*_~|▸▾◆■▶▣📊🧠📚⚙✓✕⚠→·•]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' a link ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

function pickVoice(code: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return undefined
  const base = code.split('-')[0] ?? code
  return (
    voices.find((v) => v.lang === code) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    undefined
  )
}

/** Speak text in the given language. Cancels anything currently speaking. */
export function speak(text: string, lang: Lang): void {
  if (!ttsSupported()) return
  const clean = cleanForSpeech(text)
  if (!clean) return
  const code = langCode(lang)
  const utter = new SpeechSynthesisUtterance(clean)
  utter.lang = code
  utter.rate = 1
  utter.pitch = 1
  const v = pickVoice(code)
  if (v) utter.voice = v
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  } catch (err) {
    console.warn('JACK voice: speak failed', err)
  }
}

export function stopSpeaking(): void {
  if (ttsSupported()) {
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
  }
}

/** Some browsers load voices asynchronously; call once at startup to warm them. */
export function warmVoices(): void {
  if (!ttsSupported()) return
  try {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  } catch { /* ignore */ }
}
