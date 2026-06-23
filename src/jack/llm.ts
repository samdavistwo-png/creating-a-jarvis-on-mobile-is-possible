// JACK — LLM provider layer
//
// Provider-agnostic, client-side LLM access over the OpenAI-compatible
// /chat/completions protocol. This works in a static deployment (no backend),
// is React-19 safe (no SDK dependency), and supports any compatible endpoint:
// OpenAI, OpenRouter, Groq, Together, a local Ollama, or Subscribe.dev's
// OpenAI-compatible gateway. Credentials live only in the user's browser.

export interface LLMSettings {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  /** Master switch — when false JACK uses the local rule-based brain. */
  enabled: boolean
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const KEY = 'jack.llm.v1'

export const PROVIDER_PRESETS: Array<{ label: string; baseUrl: string; model: string }> = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Together', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
]

export const DEFAULT_SETTINGS: LLMSettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  enabled: false,
}

export function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LLMSettings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: LLMSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch (err) {
    console.warn('JACK llm: failed to save settings', err)
  }
}

export function isConfigured(s: LLMSettings): boolean {
  // Local providers (Ollama) don't need a key.
  const localish = /localhost|127\.0\.0\.1/.test(s.baseUrl)
  return s.enabled && !!s.baseUrl && !!s.model && (localish || !!s.apiKey)
}

export class LLMError extends Error {}

/**
 * Single chat completion. Provider-agnostic; no streaming so it works
 * everywhere. Throws LLMError with a human-readable message on failure.
 */
export async function chat(
  settings: LLMSettings,
  messages: ChatTurn[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const url = settings.baseUrl.replace(/\/$/, '') + '/chat/completions'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`
  // OpenRouter is happier with these; harmless elsewhere.
  headers['HTTP-Referer'] = 'https://jack.apps.subscribe.dev'
  headers['X-Title'] = 'JACK'

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        model: settings.model,
        temperature: opts.temperature ?? settings.temperature,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      }),
    })
  } catch (err) {
    throw new LLMError(
      `Network error reaching ${settings.baseUrl}. Check the base URL and CORS (some providers block browser calls).`,
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message || JSON.stringify(j).slice(0, 200)
    } catch {
      detail = await res.text().catch(() => '')
    }
    if (res.status === 401 || res.status === 403)
      throw new LLMError(`Auth rejected (${res.status}). Check your API key. ${detail}`)
    if (res.status === 429) throw new LLMError(`Rate limited (429). ${detail}`)
    throw new LLMError(`Provider error ${res.status}. ${detail}`)
  }

  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new LLMError('Malformed response: no message content.')
  return content
}

/** Lightweight reachability/credentials test for the Settings panel. */
export async function testConnection(settings: LLMSettings): Promise<{ ok: boolean; message: string }> {
  try {
    const reply = await chat(
      settings,
      [
        { role: 'system', content: 'You are a connectivity probe. Reply with exactly: OK' },
        { role: 'user', content: 'ping' },
      ],
      { maxTokens: 5, temperature: 0 },
    )
    return { ok: true, message: `Connected — model responded: "${reply.trim().slice(0, 40)}"` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}
