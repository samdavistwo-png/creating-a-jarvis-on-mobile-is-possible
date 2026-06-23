# 🧠 Server Brain — real LLM, key stays server-side

JACK can use a **real LLM** (so it answers anything like ChatGPT/Claude) through
a small server-side proxy. The provider key lives **only on the server**, never
in the browser — so it's safe even though the app is public.

## How it works

```
Browser (JACK)  ──POST /api/chat──▶  Bun server (server.ts)  ──▶  LLM provider
     ▲                                  holds the key                 │
     └──────────────  answer  ◀───────────────────────────────────────┘
```

- `GET /api/llm` → `{ enabled, model }` so the app knows if a server brain exists.
- `POST /api/chat` → `{ messages }` → returns `{ text }` from the model.
- If no key is set, `/api/chat` returns `503 not_configured` and JACK falls back
  to its local conversational brain.

When enabled, the app auto-detects it on load (header shows **"server brain ·
<model>"**) and routes your questions through the model — with JACK's persona,
your name, and remembered facts included for context.

> ⚠️ Works on the **server-backed tunnel** (where the Bun server runs). It does
> **not** work on the static GitHub Pages build (no server there) — Pages
> gracefully falls back to the local brain.

## Activate it (free, ~2 minutes)

1. Get a **free Groq API key** (no credit card): https://console.groq.com/keys
2. Add it to `.env` in the project root:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```
3. Restart the dev server (`npm run dev`). The log prints
   `🧠 Server LLM brain: enabled (...)` and JACK now answers with a real LLM.

### Use a different provider
Any OpenAI-compatible API works — set these in `.env`:
```
LLM_API_KEY=...                       # the provider key
LLM_BASE_URL=https://api.openai.com/v1 # default: Groq
LLM_MODEL=gpt-4o-mini                  # default: llama-3.3-70b-versatile
```

## Security
- The key is read from the server environment only and is **never sent to the
  browser** and **never committed** (`.env` is gitignored).
- The browser only ever calls your own `/api/chat`.
