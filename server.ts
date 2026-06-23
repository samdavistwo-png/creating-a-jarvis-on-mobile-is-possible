import { watch } from 'fs'
import { join } from 'path'

const PUBLIC_DIR = join(import.meta.dir, 'public')
const BUNDLE_PATH = join(PUBLIC_DIR, 'bundle.js')

// Build the React app
async function buildApp() {
  console.log('🔨 Building React app...')
  const result = await Bun.build({
    entrypoints: ['./src/index.tsx'],
    outdir: './public',
    naming: 'bundle.js',
    minify: false,
    sourcemap: 'external',
  })

  if (!result.success) {
    console.error('❌ Build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    return false
  }

  console.log('✅ Build complete!')
  return true
}

// Initial build
await buildApp()

// Watch for changes in development
if (process.env.NODE_ENV !== 'production') {
  console.log('👀 Watching for changes...')

  watch('./src', { recursive: true }, async (event, filename) => {
    console.log(`📝 File changed: ${filename}`)
    await buildApp()
  })
}

// ── Server-side LLM proxy ──────────────────────────────────────────────
// Gives JACK a REAL "brain" without exposing any key to the browser. Point it
// at any OpenAI-compatible chat API via env vars (defaults to free Groq):
//   LLM_API_KEY   - the provider key (kept server-side only)  [also: GROQ_API_KEY]
//   LLM_BASE_URL  - default https://api.groq.com/openai/v1
//   LLM_MODEL     - default llama-3.3-70b-versatile
// When LLM_API_KEY is set, the frontend auto-uses /api/chat (on the tunnel).
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.GROQ_API_KEY || ''
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '')
const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function handleChat(req: Request): Promise<Response> {
  if (!LLM_API_KEY) {
    return new Response(JSON.stringify({ error: 'not_configured', message: 'No server LLM key set. Add LLM_API_KEY (or GROQ_API_KEY) to .env to enable JACK\'s server brain.' }), { status: 503, headers: JSON_HEADERS })
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: JSON_HEADERS })
  }
  const messages = Array.isArray(body?.messages) && body.messages.length
    ? body.messages
    : [{ role: 'user', content: String(body?.prompt ?? '') }]
  try {
    const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({
        model: body?.model || LLM_MODEL,
        messages,
        temperature: typeof body?.temperature === 'number' ? body.temperature : 0.4,
        max_tokens: 800,
      }),
    })
    const data: any = await upstream.json()
    if (!upstream.ok) {
      const msg = data?.error?.message || `upstream ${upstream.status}`
      console.log('JACK proxy upstream error:', msg)
      return new Response(JSON.stringify({ error: 'upstream_error', message: msg }), { status: 502, headers: JSON_HEADERS })
    }
    const text = data?.choices?.[0]?.message?.content ?? ''
    return new Response(JSON.stringify({ text, model: data?.model || LLM_MODEL }), { headers: JSON_HEADERS })
  } catch (err) {
    console.log('JACK proxy error:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ error: 'proxy_error', message: 'Failed to reach the LLM provider.' }), { status: 502, headers: JSON_HEADERS })
  }
}

// Start the Bun server with console: true
const server = Bun.serve({
  port: 8080,
  development: {
    console: true, // This enables frontend console logs to appear in backend!
  },
  async fetch(req) {
    const url = new URL(req.url)

    // LLM proxy: report whether a server brain is configured
    if (url.pathname === '/api/llm') {
      return new Response(JSON.stringify({ enabled: !!LLM_API_KEY, model: LLM_MODEL }), { headers: JSON_HEADERS })
    }

    // LLM proxy: chat completion (key stays on the server)
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      return handleChat(req)
    }

    // Serve the bundle
    if (url.pathname === '/bundle.js') {
      return new Response(Bun.file(BUNDLE_PATH))
    }

    // Serve the bundle source map
    if (url.pathname === '/bundle.js.map') {
      return new Response(Bun.file(join(PUBLIC_DIR, 'bundle.js.map')))
    }

    // Serve index.html for all other routes
    return new Response(Bun.file(join(PUBLIC_DIR, 'index.html')), {
      headers: { 'Content-Type': 'text/html' }
    })
  },
})

console.log(`🧠 Server LLM brain: ${LLM_API_KEY ? `enabled (${LLM_MODEL})` : 'disabled — set LLM_API_KEY / GROQ_API_KEY in .env'}`)

console.log(`🚀 Bun server running at http://localhost:${server.port}`)
console.log(`🖥️  Frontend console.log() will appear here in the terminal!`)
