# JACK — your JARVIS for mobile

JACK is an autonomous AI assistant that runs as a mobile-friendly web app. It can
**talk with you in English and Tamil**, **speak back**, **open websites and web
apps on command**, **learn new commands**, and **reason about security &
infrastructure**. Everything personal (memory, learned tools, learned
automations) is stored **locally in your browser** — no account, no server
database.

```
┌──────────────────────────────────────────────────────────────┐
│  🎤 You speak / type  ─▶  🧠 JACK understands  ─▶  ⚡ Action   │
│   (English / Tamil)        (local engine or LLM)   open app /  │
│                                                    answer /     │
│   🔊 JACK speaks back  ◀───────────────────────────  learn      │
└──────────────────────────────────────────────────────────────┘
```

## Feature map

| Area | What it does | Where |
|------|--------------|-------|
| **Voice input** | Speak commands in English (`en-IN`) or Tamil (`ta-IN`) | 🎤 button on Console |
| **Voice output** | JACK reads its replies aloud in the chosen language | `🔊 JACK voice` toggle |
| **Automations** | "open youtube", "play netflix", "open video editor", Tamil "யூடியூப் திற" | ⚡ Automations tab |
| **Learning** | Teach custom commands that persist across sessions | chat or ⚡ tab |
| **Memory** | Remembers preferences, facts, and task history | 🧠 Memory tab |
| **Knowledge base** | ~60 seeded security/devops tools & concepts, grows over time | 📚 Knowledge tab |
| **Security brain** | Firewalls, hardened Dockerfiles, reverse proxies, monitoring | Console |
| **LLM brain (optional)** | Connect any OpenAI-compatible API for free-form reasoning | ⚙ Settings |

## The two brains

1. **Local engine (default)** — runs entirely in your browser. Handles
   automations, memory, security playbooks, and monitoring. No key required.
2. **LLM brain (optional)** — open **⚙ Settings** and connect any
   OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, or a local Ollama).
   The key is stored only in your browser and sent directly to the provider.
   With it connected, JACK reasons freely, uses tools, and **auto-learns** new
   tools into its Knowledge base.

## Privacy

- 🔒 Memory, knowledge, learned automations, and LLM settings live in
  `localStorage` on your device.
- Use **🧠 Memory ▸ Export** to download a JSON backup, or **Wipe** to clear it.
- JACK never modifies its own code; state-changing security plans always require
  your explicit approval.

See also: [AUTOMATIONS.md](./AUTOMATIONS.md) · [VOICE.md](./VOICE.md) · [MEMORY.md](./MEMORY.md)
