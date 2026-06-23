# 🧠 Memory & 📚 Knowledge — JACK learns and remembers

JACK keeps getting smarter the more you use it. Two complementary systems power
this, both stored locally in your browser.

## 🧠 Memory (`jack.memory.v1`)

Personal context JACK remembers across sessions:

- **Preferences** — e.g. say *"my name is Sam"* and JACK remembers it.
- **Facts** — things worth recalling later (most recent 50 kept).
- **Task history** — a log of plans and automations you ran (most recent 100).

Manage it in the **🧠 Memory** tab:
- **⤓ Export** — download `jack-memory.json` as a backup.
- **Wipe** — clear everything instantly.

## 📚 Knowledge base (`jack.knowledge.v1`)

A growing library of tools and concepts JACK "knows". It ships with **~60 seeded
entries** across categories: firewall, intrusion detection, recon, vulnerability
scanning, secrets, TLS/PKI, identity & zero-trust, containers & Kubernetes,
IaC security, monitoring, forensics, backups, VPN, plus core security
**concepts** (defense-in-depth, least-privilege, zero-trust, threat-modeling,
MITRE ATT&CK, CIS benchmarks).

It grows three ways:

1. **Automatically** — when the LLM brain encounters a new tool, it records it
   via the `learn_tool` action.
2. **Manually** — teach a tool from the **📚 Knowledge** tab.
3. **On upgrade** — when new seed tools ship in a release, they are **merged into
   your existing knowledge** on load **without deleting** anything you've already
   learned or been taught (`mergeNewSeeds` in `src/jack/knowledge.ts`).

The knowledge base is injected into the LLM's context, so JACK genuinely
improves over time.

## 💡 Knowledge pack (built-in skills)

JACK ships with a **knowledge pack** — a set of seeded skills (`SEED_SKILLS` in
`src/jack/evolve.ts`) that let it answer and speak useful facts out of the box,
**no LLM required**. Ask things like:

- "what is zero trust", "what is defense in depth", "what is least privilege"
- "what is the CIA triad", "what is phishing", "what is ransomware", "what is 2FA"
- "what is SQL injection", "what is XSS", "what is encryption", "backup rule"
- "what is docker", "what is kubernetes", "what is https", "what is a vpn", "what is an api", "what is git"
- "how to generate ssh key", "what is a firewall", "who are you jack"

New knowledge-pack entries shipped in updates are **merged into your skills
automatically** without removing skills you authored. This is how fresh
knowledge gets fed into JACK over time.

## ⚡ Learned automations (`jack.automations.v1`)

Custom "open X" commands you teach JACK (see [AUTOMATIONS.md](./AUTOMATIONS.md))
are persisted here and survive restarts.

## Storage summary

| Key | Contents |
|-----|----------|
| `jack.memory.v1` | preferences, facts, task history |
| `jack.knowledge.v1` | known tools & concepts |
| `jack.automations.v1` | your taught open-commands |
| `jack.llm.v1` | optional LLM connection settings |

All of it is local to your browser/device. Clearing site data or using the Wipe
buttons resets JACK to a fresh state.
