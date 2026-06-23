# 🖥️ Run JACK fully offline (local AI, no external API)

You can run JACK's brain **entirely on your own PC** with no cloud and no API
key — using an open-source model via **Ollama**. JACK's server proxy already
speaks the OpenAI-compatible protocol, so pointing it at a local model is just a
few environment variables.

> What runs where: JACK's UI + server run as today; only the **model** moves to
> your machine. The stronger your hardware, the stronger the model you can run.

## Quick start (≈10 minutes)

1. **Install Ollama** — https://ollama.com (Windows, macOS, Linux).
2. **Pull and run a model:**
   ```bash
   ollama run llama3        # 8B — great on 16 GB RAM / RTX 3060
   # or: ollama run mistral
   # or: ollama run gemma2
   ```
   Ollama serves an OpenAI-compatible API at `http://localhost:11434/v1`.
3. **Point JACK at it** — in `.env`:
   ```
   LLM_BASE_URL=http://localhost:11434/v1
   LLM_MODEL=llama3
   LLM_API_KEY=ollama        # any non-empty value; Ollama ignores it
   ```
4. **Restart JACK:** `npm run dev`. The log shows
   `🧠 Server LLM brain: enabled (llama3)` and JACK now answers from your
   **local, offline** model. Zero external calls.

That's a fully offline ChatGPT-style assistant — voice, automations, memory and
all — running on your own hardware.

## How your blueprint maps to JACK

| Blueprint phase | In JACK today | File |
|---|---|---|
| Frontend (React) | ✅ React 19 UI | `src/App.tsx` |
| Backend (FastAPI ↔ Bun) | ✅ HTTP server + LLM proxy | `server.ts` |
| LLM engine | ✅ OpenAI-compatible proxy (cloud **or** local Ollama) | `server.ts`, `src/jack/serverbrain.ts` |
| Local model (Llama/Mistral/Gemma) | ✅ via Ollama (this guide) | `.env` |
| Memory + DB | ✅ preferences/facts/history (browser storage) | `src/jack/memory.ts` |
| Voice (STT/TTS) | ✅ English + Tamil | `src/jack/voice.ts` |
| Tools / automation | ✅ open sites/apps, teachable | `src/jack/automations.ts` |
| Self-improvement (fix→test→approve→deploy) | ✅ human-approved Evolve lab | `src/jack/evolve.ts` |

## Hardware guide (from your blueprint)

| Tier | RAM | GPU | Good for |
|---|---|---|---|
| Experiment | 16 GB | RTX 3060 (12 GB) | 7–8B models (llama3, mistral) |
| Comfortable | 32 GB | RTX 4070/4080 | 8–14B, faster responses |
| Serious | 64+ GB | RTX 4090 / multi-GPU | 30–70B models |

## Why not train from scratch?

Training a ChatGPT-class model costs hundreds of crores and huge compute. The
practical path (and what JACK does) is to **stand on open-source models** and add
the assistant layer — memory, voice, tools, retrieval, and human-approved
self-improvement — which is exactly where the real product value is.

## Provider options at a glance

| Mode | `.env` | Pros |
|---|---|---|
| **Local (Ollama)** | `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=llama3`, `LLM_API_KEY=ollama` | Fully offline, private, free |
| **Groq (cloud)** | `GROQ_API_KEY=gsk_...` | No hardware needed, very fast, free tier |
| **OpenAI/OpenRouter** | `LLM_API_KEY=...`, `LLM_BASE_URL=...`, `LLM_MODEL=...` | Frontier models |

JACK works with all three — switch any time by changing `.env` and restarting.

## Self-improvement safety (your Phase 6)

JACK follows your exact safe loop: **find issue → suggest fix → test → request
human approval → deploy.** It never performs unrestricted self-modification or
hot-patches its own running code. See [EVOLVE.md](./EVOLVE.md).
