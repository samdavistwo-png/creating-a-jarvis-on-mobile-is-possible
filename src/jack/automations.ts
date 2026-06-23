// JACK — Automations engine
//
// Lets JACK "do things" from a voice or text command: open websites, web apps,
// a video editor, and more. Commands work in English and Tamil. Users can also
// TEACH JACK new automations ("when I say X open <url>") which are stored in
// localStorage so JACK remembers them across sessions.
//
// Everything opens in a new browser tab (the only safe, universal action a web
// app can take). On mobile, https links to apps like YouTube/WhatsApp/Maps will
// open the native app via the OS when it is installed.

export interface Automation {
  id: string
  label: string
  url: string
  icon: string
  category: string
  /** Lowercased trigger phrases (English + Tamil). Label is also matched. */
  triggers: string[]
  source: 'builtin' | 'learned'
}

// Action verbs that signal "open / launch / play" intent — English + Tamil.
export const ACTION_WORDS = [
  'open', 'launch', 'start', 'go to', 'goto', 'show', 'show me', 'play', 'take me to',
  'bring up', 'load', 'visit', 'run', 'fire up',
  // Tamil (script + common transliterations)
  'திற', 'திறக்க', 'திறந்து', 'காட்டு', 'போடு', 'செல்', 'ஓப்பன்', 'thira', 'thirakka', 'kaattu', 'podu',
]

export const BUILTIN: Automation[] = [
  // — media & video —
  { id: 'youtube', label: 'YouTube', url: 'https://youtube.com', icon: '▶', category: 'media', triggers: ['youtube', 'yt', 'யூடியூப்'], source: 'builtin' },
  { id: 'netflix', label: 'Netflix', url: 'https://netflix.com', icon: '🎬', category: 'media', triggers: ['netflix', 'நெட்ஃபிளிக்ஸ்'], source: 'builtin' },
  { id: 'prime', label: 'Prime Video', url: 'https://primevideo.com', icon: '🎬', category: 'media', triggers: ['prime video', 'prime', 'amazon prime'], source: 'builtin' },
  { id: 'hotstar', label: 'Hotstar', url: 'https://hotstar.com', icon: '🌟', category: 'media', triggers: ['hotstar', 'disney hotstar', 'ஹாட்ஸ்டார்'], source: 'builtin' },
  { id: 'spotify', label: 'Spotify', url: 'https://open.spotify.com', icon: '🎵', category: 'media', triggers: ['spotify', 'music', 'பாட்டு', 'ஸ்பாட்டிஃபை'], source: 'builtin' },

  // — video / photo editors —
  { id: 'clipchamp', label: 'Video Editor (Clipchamp)', url: 'https://app.clipchamp.com', icon: '🎞', category: 'editor', triggers: ['video editor', 'clipchamp', 'edit video', 'வீடியோ எடிட்டர்', 'வீடியோ எடிட்'], source: 'builtin' },
  { id: 'capcut', label: 'CapCut', url: 'https://www.capcut.com/editor', icon: '✂️', category: 'editor', triggers: ['capcut', 'cap cut'], source: 'builtin' },
  { id: 'canva', label: 'Canva', url: 'https://www.canva.com', icon: '🎨', category: 'editor', triggers: ['canva', 'design', 'poster'], source: 'builtin' },
  { id: 'photopea', label: 'Photo Editor (Photopea)', url: 'https://www.photopea.com', icon: '🖼', category: 'editor', triggers: ['photo editor', 'photopea', 'edit photo', 'photoshop', 'புகைப்பட எடிட்டர்'], source: 'builtin' },

  // — communication & social —
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://web.whatsapp.com', icon: '💬', category: 'social', triggers: ['whatsapp', 'whats app', 'வாட்ஸ்அப்'], source: 'builtin' },
  { id: 'telegram', label: 'Telegram', url: 'https://web.telegram.org', icon: '✈️', category: 'social', triggers: ['telegram', 'டெலிகிராம்'], source: 'builtin' },
  { id: 'instagram', label: 'Instagram', url: 'https://instagram.com', icon: '📸', category: 'social', triggers: ['instagram', 'insta', 'இன்ஸ்டாகிராம்'], source: 'builtin' },
  { id: 'facebook', label: 'Facebook', url: 'https://facebook.com', icon: '👥', category: 'social', triggers: ['facebook', 'fb', 'ஃபேஸ்புக்'], source: 'builtin' },
  { id: 'twitter', label: 'X (Twitter)', url: 'https://x.com', icon: '𝕏', category: 'social', triggers: ['twitter', 'x.com', 'tweet'], source: 'builtin' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com', icon: '💼', category: 'social', triggers: ['linkedin', 'லிங்க்ட்இன்'], source: 'builtin' },
  { id: 'reddit', label: 'Reddit', url: 'https://reddit.com', icon: '👽', category: 'social', triggers: ['reddit'], source: 'builtin' },

  // — google & productivity —
  { id: 'google', label: 'Google', url: 'https://google.com', icon: '🔎', category: 'productivity', triggers: ['google', 'search', 'கூகுள்'], source: 'builtin' },
  { id: 'gmail', label: 'Gmail', url: 'https://mail.google.com', icon: '✉️', category: 'productivity', triggers: ['gmail', 'email', 'mail', 'மெயில்'], source: 'builtin' },
  { id: 'gmaps', label: 'Google Maps', url: 'https://maps.google.com', icon: '🗺', category: 'productivity', triggers: ['google maps', 'maps', 'map', 'directions', 'வரைபடம்', 'மேப்'], source: 'builtin' },
  { id: 'gtranslate', label: 'Google Translate', url: 'https://translate.google.com', icon: '🌐', category: 'productivity', triggers: ['translate', 'google translate', 'மொழிபெயர்'], source: 'builtin' },
  { id: 'gdrive', label: 'Google Drive', url: 'https://drive.google.com', icon: '📁', category: 'productivity', triggers: ['google drive', 'drive'], source: 'builtin' },
  { id: 'gcal', label: 'Google Calendar', url: 'https://calendar.google.com', icon: '📅', category: 'productivity', triggers: ['calendar', 'google calendar', 'காலண்டர்'], source: 'builtin' },
  { id: 'gdocs', label: 'Google Docs', url: 'https://docs.google.com', icon: '📄', category: 'productivity', triggers: ['google docs', 'docs', 'document'], source: 'builtin' },
  { id: 'gsheets', label: 'Google Sheets', url: 'https://sheets.google.com', icon: '📊', category: 'productivity', triggers: ['google sheets', 'sheets', 'spreadsheet'], source: 'builtin' },
  { id: 'gnews', label: 'Google News', url: 'https://news.google.com', icon: '📰', category: 'productivity', triggers: ['news', 'google news', 'செய்தி'], source: 'builtin' },
  { id: 'weather', label: 'Weather', url: 'https://www.google.com/search?q=weather', icon: '⛅', category: 'productivity', triggers: ['weather', 'வானிலை'], source: 'builtin' },

  // — shopping —
  { id: 'amazon', label: 'Amazon', url: 'https://amazon.in', icon: '🛒', category: 'shopping', triggers: ['amazon', 'அமேசான்'], source: 'builtin' },
  { id: 'flipkart', label: 'Flipkart', url: 'https://flipkart.com', icon: '🛍', category: 'shopping', triggers: ['flipkart', 'பிளிப்கார்ட்'], source: 'builtin' },

  // — knowledge & AI —
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖', category: 'ai', triggers: ['chatgpt', 'chat gpt', 'gpt', 'openai'], source: 'builtin' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai', icon: '🧠', category: 'ai', triggers: ['claude', 'anthropic'], source: 'builtin' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com', icon: '✨', category: 'ai', triggers: ['gemini', 'bard'], source: 'builtin' },
  { id: 'wikipedia', label: 'Wikipedia', url: 'https://wikipedia.org', icon: '📚', category: 'ai', triggers: ['wikipedia', 'wiki', 'விக்கிபீடியா'], source: 'builtin' },

  // — developer —
  { id: 'github', label: 'GitHub', url: 'https://github.com', icon: '🐙', category: 'developer', triggers: ['github', 'git hub', 'கிட்ஹப்'], source: 'builtin' },
  { id: 'stackoverflow', label: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '🧩', category: 'developer', triggers: ['stackoverflow', 'stack overflow'], source: 'builtin' },
  { id: 'vscode', label: 'VS Code (web)', url: 'https://vscode.dev', icon: '💻', category: 'developer', triggers: ['vscode', 'vs code', 'code editor', 'editor'], source: 'builtin' },
  { id: 'replit', label: 'Replit', url: 'https://replit.com', icon: '🛠', category: 'developer', triggers: ['replit'], source: 'builtin' },
]

const KEY = 'jack.automations.v1'

export function loadAutomations(): Automation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Automation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAutomations(list: Automation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('JACK automations: failed to save', err)
  }
}

export function addAutomation(list: Automation[], a: Omit<Automation, 'source'> & { source?: Automation['source'] }): { list: Automation[]; item: Automation } {
  const item: Automation = { ...a, source: a.source ?? 'learned' }
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 100)
  saveAutomations(next)
  return { list: next, item }
}

export function removeAutomation(list: Automation[], id: string): Automation[] {
  const next = list.filter((a) => a.id !== id)
  saveAutomations(next)
  return next
}

export function isOpenIntent(text: string): boolean {
  const t = ` ${text.toLowerCase()} `
  return ACTION_WORDS.some((w) => t.includes(` ${w} `) || t.includes(`${w} `) || text.toLowerCase().includes(w))
}

/** Find the best automation for a command. Longest matching phrase wins, so
 * "open google maps" beats "open google". Returns null if nothing matches. */
export function matchAutomation(text: string, customs: Automation[]): Automation | null {
  const t = ` ${text.toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim()} `
  const all = [...customs, ...BUILTIN]
  let best: { a: Automation; len: number } | null = null
  for (const a of all) {
    const phrases = [a.label.toLowerCase(), ...a.triggers.map((x) => x.toLowerCase())]
    for (const p of phrases) {
      const phrase = p.trim()
      if (phrase.length < 2) continue
      if (t.includes(` ${phrase} `) || t.endsWith(` ${phrase} `) || t.includes(`${phrase}`)) {
        if (!best || phrase.length > best.len) best = { a, len: phrase.length }
      }
    }
  }
  return best?.a ?? null
}

export function runAutomation(a: Automation): void {
  if (typeof window !== 'undefined') {
    console.log('JACK automation → open', a.label, a.url)
    window.open(a.url, '_blank', 'noopener,noreferrer')
  }
}

const URL_RE = /\bhttps?:\/\/[^\s]+/i
const DOMAIN_RE = /\b([a-z0-9-]+\.[a-z]{2,})(\/[^\s]*)?\b/i

/** Parse a "teach me an automation" instruction. Supports:
 *   "when I say <triggers> open <url>"
 *   "teach: <triggers> => <url>"
 *   "remember <name> as <url>"
 *   "open <url>"  (raw url → quick automation)
 * Returns a ready-to-store Automation, or null if no URL/site is present. */
export function parseTaughtAutomation(text: string): Automation | null {
  const lower = text.toLowerCase()
  let url = (text.match(URL_RE)?.[0]) || ''
  if (!url) {
    const dm = text.match(DOMAIN_RE)
    if (dm) url = `https://${dm[1]}${dm[2] ?? ''}`
  }
  if (!url) return null

  // Extract triggers from common phrasings.
  let triggers: string[] = []
  let label = ''
  const whenMatch = lower.match(/when i say\s+(.+?)\s+(?:open|launch|go to|show|play|=>)/)
  const teachMatch = lower.match(/teach:?\s+(.+?)\s*=>\s*/)
  const callItMatch = lower.match(/call it\s+([a-z0-9 ]+)/)
  const rememberMatch = lower.match(/remember\s+(.+?)\s+as\s+/)
  if (whenMatch) triggers = splitTriggers(whenMatch[1] ?? '')
  else if (teachMatch) triggers = splitTriggers(teachMatch[1] ?? '')
  else if (rememberMatch) triggers = splitTriggers(rememberMatch[1] ?? '')

  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    label = callItMatch ? (callItMatch[1] ?? '').trim() : (host.split('.')[0] ?? host)
    if (!triggers.length) triggers = [label.toLowerCase(), host]
  } catch {
    return null
  }

  const id = `learned_${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${url.length}`
  return { id, label: cap(label), url, icon: '⭐', category: 'custom', triggers: Array.from(new Set(triggers)), source: 'learned' }
}

function splitTriggers(s: string): string[] {
  return s
    .replace(/["']/g, '')
    .split(/\s*(?:,|\/|\bor\b|\band\b)\s*/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 1)
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
