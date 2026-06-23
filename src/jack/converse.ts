// JACK — Conversational engine
//
// Makes JACK feel like it's actually talking with you instead of replying with
// one canned line. It:
//   1. answers "what is / explain / how does / tell me about X" questions by
//      searching JACK's knowledge base + a broad built-in fact dictionary, and
//   2. handles small-talk (how are you, thanks, your name, jokes) warmly, with
//      varied phrasing so it never repeats the exact same sentence.
//
// Honest scope: this is a local engine, not a frontier LLM. For open-ended
// reasoning on ANY topic, connect an LLM brain in ⚙ Settings — then JACK answers
// like ChatGPT/Claude. This engine makes the *offline* experience genuinely
// conversational and useful.

import type { KnownTool } from './knowledge'

export interface ConverseContext {
  tools: KnownTool[]
  userName?: string
  factCount: number
}

export interface ConverseResult {
  text: string
  /** When true, JACK couldn't answer locally and should suggest the LLM brain. */
  lowConfidence?: boolean
}

// A broad, general-knowledge dictionary so JACK can explain everyday tech/AI
// topics that aren't security tools. Kept concise and conversational.
const FACTS: Record<string, string> = {
  internet: 'The internet is a global network of computers that talk to each other using shared protocols (mainly TCP/IP). The web, email, and apps all ride on top of it.',
  web: 'The World Wide Web is the system of linked pages and apps you browse over the internet using HTTP/HTTPS and a browser.',
  computer: 'A computer is a machine that stores and processes information by running instructions (programs) on a processor, using memory and storage.',
  ai: 'Artificial Intelligence is software that performs tasks we associate with human intelligence — understanding language, recognising images, reasoning, and making decisions. Modern AI mostly learns patterns from large amounts of data.',
  'machine learning': 'Machine learning is AI that learns patterns from data instead of being explicitly programmed. You feed it examples, and it generalises to new inputs.',
  'deep learning': 'Deep learning is machine learning using many-layered neural networks. It powers today\'s image, speech and language models.',
  'neural network': 'A neural network is a model loosely inspired by the brain: layers of simple units with weights that adjust during training to map inputs to outputs.',
  chatgpt: 'ChatGPT is OpenAI\'s conversational AI built on large language models (the GPT series). It generates human-like text and can answer, write and reason. You can open it from the Automations tab.',
  claude: 'Claude is Anthropic\'s family of AI assistants, designed to be helpful, harmless and honest. Like me, it converses and reasons — and you can connect a model like it as my "brain" in Settings.',
  llm: 'A Large Language Model (LLM) is an AI trained on huge amounts of text to predict and generate language. It\'s what makes ChatGPT and Claude able to chat, summarise, code and reason.',
  blockchain: 'A blockchain is a shared, append-only ledger spread across many computers, secured by cryptography so records can\'t be quietly changed. It underpins cryptocurrencies.',
  'cloud computing': 'Cloud computing means renting computing power, storage and services over the internet (e.g. AWS, Google Cloud) instead of owning the hardware.',
  'operating system': 'An operating system (Windows, macOS, Linux, Android, iOS) is the core software that manages hardware and runs your apps.',
  browser: 'A web browser (Chrome, Safari, Firefox, Edge) is the app that fetches and displays web pages and runs web apps — like the one running me right now.',
  html: 'HTML is the markup language that defines the structure and content of a web page — headings, text, links, images.',
  css: 'CSS styles web pages — colours, layout, spacing, fonts — separating how things look from what they are (HTML).',
  javascript: 'JavaScript is the programming language of the web; it makes pages interactive and also runs servers (via Node/Bun). I\'m written in TypeScript, a typed flavour of it.',
  database: 'A database stores and organises data so apps can save, search and update it reliably. SQL databases use tables; NoSQL ones use documents or key-values.',
  algorithm: 'An algorithm is a precise step-by-step procedure for solving a problem or computing a result — like a recipe a computer follows.',
  server: 'A server is a computer (or program) that provides data or services to other computers ("clients") over a network — for example, serving this app to your phone.',
  dns: 'DNS is the internet\'s phone book: it translates human names like example.com into the numeric IP addresses computers use.',
  'ip address': 'An IP address is a numeric label identifying a device on a network, so data knows where to go — like a postal address for computers.',
  url: 'A URL is the web address of a resource — the protocol, domain and path you type to reach a page, e.g. https://example.com/page.',
  cookie: 'A cookie is a small piece of data a website stores in your browser to remember things like your login or preferences between visits.',
  cache: 'A cache stores copies of data close to where it\'s needed so it can be reused quickly instead of fetched again — speeding things up.',
  'open source': 'Open source software has publicly available code that anyone can read, use, modify and share. This very app is open source on GitHub.',
}

const QUESTION_RE = /\b(what(?:'s| is| are)?|whats|who(?:'s| is| are)?|explain|define|tell me about|how (?:do|does|to|can)|why)\b/i

const STOPWORDS = new Set(['what', 'whats', 'is', 'are', 'a', 'an', 'the', 'who', 'explain', 'define', 'tell', 'me', 'about', 'how', 'do', 'does', 'to', 'can', 'why', "what's", "who's", 'of', 'in', 'on', 'for', 'mean', 'meaning', 'and', 'jack', 'please'])

/** Deterministic-ish pick so phrasing varies but stays stable within a render. */
function pick<T>(arr: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return arr[Math.abs(h) % arr.length] as T
}

function extractTopic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim()
}

/** Try to answer a general question conversationally. Returns null if this
 * doesn't look like something the conversation engine should handle. */
export function converse(text: string, ctx: ConverseContext): ConverseResult | null {
  const t = text.toLowerCase().trim()
  const who = ctx.userName ? `, ${ctx.userName}` : ''

  // — small talk —
  if (/\b(how are you|how('?s| is) it going|how do you do|what'?s up|sup)\b/.test(t)) {
    return { text: pick([
      `I'm running at full power and ready to help${who}. How are *you* doing?`,
      `All systems green and feeling sharp${who}. What can I do for you?`,
      `Doing great — every circuit humming${who}. What's on your mind?`,
    ], t) }
  }
  if (/\b(thank you|thanks|thx|nandri|நன்றி)\b/.test(t)) {
    return { text: pick([`Anytime${who} — that's what I'm here for.`, `Happy to help${who}. Ask me anything else.`, `My pleasure${who}.`], t) }
  }
  if (/\b(tell me a joke|joke|make me laugh)\b/.test(t)) {
    return { text: pick([
      'Why did the developer go broke? Because he used up all his cache. 😄',
      'There are 10 kinds of people: those who understand binary and those who don\'t. 🤖',
      'I told my firewall a secret… it just dropped it. 🔥',
    ], t) }
  }
  if (/\b(i love you|you'?re awesome|you are great|good job|well done)\b/.test(t)) {
    return { text: `Thank you${who}! I'm built to be genuinely useful to you — let's keep going.` }
  }
  if (/\b(good morning|good night|good evening|good afternoon)\b/.test(t)) {
    const part = t.includes('night') ? 'Good night' : t.includes('morning') ? 'Good morning' : t.includes('evening') ? 'Good evening' : 'Good afternoon'
    return { text: `${part}${who}! JACK here, ready whenever you are.` }
  }

  // — question answering —
  if (QUESTION_RE.test(t)) {
    const topic = extractTopic(t)
    if (topic) {
      // 1) search the knowledge base (90+ tools/concepts)
      const hit = findTool(ctx.tools, topic)
      if (hit) {
        const usage = hit.usage ? `\n\nFor example: \`${hit.usage}\`` : ''
        return { text: `**${hit.name}** — ${hit.summary}${usage}\n\nWant me to go deeper on this or show something related${who}?` }
      }
      // 2) search the broad fact dictionary
      const fact = findFact(topic)
      if (fact) {
        return { text: `${fact.value}\n\nAnything specific about ${fact.key} you'd like me to expand on${who}?` }
      }
      // 3) honest, conversational miss — offer the real path
      return {
        lowConfidence: true,
        text:
          `Good question${who}. I don't have a solid built-in answer for "${topic}" yet — and I'd rather not make something up.\n\n` +
          `Here's the honest deal: for open-ended questions on *any* topic, I answer best with a real **LLM brain** connected (that's what makes ChatGPT/Claude so capable). Tap **⚙ Settings**, connect a model, and I'll research, analyse and explain like them — and I'll **remember** what we learn.\n\n` +
          `Or teach me directly: say *"remember that ${topic} is …"* and I'll keep it.`,
      }
    }
  }

  return null
}

function findTool(tools: KnownTool[], topic: string): KnownTool | undefined {
  const words = topic.split(/\s+/).filter(Boolean)
  // exact-ish name match first
  let best: { tool: KnownTool; score: number } | undefined
  for (const tool of tools) {
    const name = tool.name.toLowerCase()
    let score = 0
    if (topic === name) score = 100
    else if (topic.includes(name) || name.includes(topic)) score = 60 + name.length
    else {
      for (const w of words) if (w.length > 2 && name.includes(w)) score += 10
    }
    if (score > 0 && (!best || score > best.score)) best = { tool, score }
  }
  return best && best.score >= 20 ? best.tool : undefined
}

function findFact(topic: string): { key: string; value: string } | undefined {
  if (FACTS[topic]) return { key: topic, value: FACTS[topic] }
  // partial: topic contains a known key or vice-versa
  for (const key of Object.keys(FACTS)) {
    if (topic.includes(key) || key.includes(topic)) return { key, value: FACTS[key] as string }
  }
  return undefined
}
