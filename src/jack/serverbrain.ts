// JACK — Server brain client
//
// Talks to the Bun server's /api/chat proxy, which calls a real LLM with a key
// kept server-side (never in the browser). This is what lets JACK answer like
// ChatGPT/Claude on the tunnel without you pasting a key into the page.
//
// On static hosting (GitHub Pages) there is no server, so /api/llm simply
// reports disabled and JACK falls back to its local conversational brain.

export interface ServerBrainStatus {
  enabled: boolean
  model: string
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Detect whether a server-side LLM brain is available. Safe on static hosts. */
export async function detectServerBrain(signal?: AbortSignal): Promise<ServerBrainStatus> {
  try {
    const res = await fetch('/api/llm', { signal })
    if (!res.ok) return { enabled: false, model: '' }
    const data = (await res.json()) as ServerBrainStatus
    return { enabled: !!data.enabled, model: data.model || '' }
  } catch {
    return { enabled: false, model: '' }
  }
}

/** Ask the server brain. Throws on failure so the caller can fall back. */
export async function askServerBrain(messages: ChatTurn[], signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as any)?.message || `server brain error (${res.status})`)
  }
  const text = (data as any)?.text
  if (!text) throw new Error('empty response from server brain')
  return text as string
}

/** Build the chat messages for a JACK request: persona + memory + recent turns. */
export function buildMessages(opts: {
  text: string
  history: { role: string; text: string }[]
  userName?: string
  facts: string[]
  lang: 'en' | 'ta'
}): ChatTurn[] {
  const { text, history, userName, facts, lang } = opts
  const persona =
    'You are JACK, a friendly, capable JARVIS-style AI assistant living in a mobile web app. ' +
    'Answer ANY question helpfully and conversationally, like a knowledgeable partner — not a robot. ' +
    'Keep replies clear and reasonably concise (a few short paragraphs max). ' +
    (lang === 'ta'
      ? 'The user prefers Tamil — reply in Tamil when they write in Tamil. '
      : 'Reply in the language the user writes in (English or Tamil). ') +
    (userName ? `The user's name is ${userName}. ` : '') +
    (facts.length ? `Things you remember about the user: ${facts.slice(-8).join('; ')}.` : '')

  const turns: ChatTurn[] = [{ role: 'system', content: persona }]
  for (const m of history.slice(-8)) {
    if (!m.text) continue
    turns.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
  }
  turns.push({ role: 'user', content: text })
  return turns
}
