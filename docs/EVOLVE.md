# 🧬 Self-Improvement Lab & 🧠 Deep Think

JACK improves itself — safely, and under your control. This is the honest,
working version of "JACK modifies and adds to its own code to get better".

## What "self-improvement" really means here

A web app running on your phone **cannot** rewrite its own compiled bundle at
runtime, and **no** app becomes a superintelligence by toggling a setting.
Anyone who claims otherwise is selling you magic. Instead, JACK gets genuinely
better through three real mechanisms:

### 1. Skills — JACK adds new behaviour to itself
A **skill** is a `trigger → response` capability JACK authors. The moment you
approve it, JACK starts using it, and it persists in your browser. This is true
self-extension: JACK adds new abilities to itself without anyone editing source
code.

- JACK proposes skills based on how you use it (e.g. a fast-path into the area
  you use most, or a personalised greeting once it knows your name).
- You can also author one yourself in the **🧬 Evolve** tab (name, triggers,
  response).
- Skills are stored in `localStorage` (`jack.skills.v1`) and matched on every
  message before the general brain runs.

### 2. Code proposals — JACK writes upgrades to its own source
JACK drafts concrete patches to its **own source files** (PWA install, streaming
LLM replies, a proactive morning briefing, a "Hey JACK" wake word, …) and shows
them as a diff with rationale. You **approve** what ships. This honours JACK's
core guardrail — *JACK writes the code, a human decides to deploy it* — which is
exactly how a safe self-improving system should behave. Accepted proposals are
logged to memory; ask JACK (with an LLM brain connected) to "implement it" and it
will prepare the change for review.

### 3. Deep Think — a transparent, powerful reasoning loop
Toggle **🧠 Deep Think** on the Console and JACK shows its multi-step reasoning
before answering:

```
1 · Understand   → classify the goal
2 · Recall       → cross-reference known tools + remembered facts
3 · Decompose    → prerequisites → steps → verification
4 · Critique     → check risk + whether approval is needed
5 · Synthesise   → assemble the clearest answer/plan
```

Locally this is a structured heuristic you can inspect. With an **LLM brain**
connected (⚙ Settings), the same staged approach runs with real model reasoning,
which is where JACK's "thinking" becomes genuinely powerful. Connect a strong
model and Deep Think gives you deliberate, self-critiquing answers instead of
one-shot replies.

## Guardrails (by design)

- ✅ Every new skill and every code change is **human-approved**.
- ✅ JACK never executes arbitrary code or hot-patches its running bundle.
- ✅ All state-changing security actions still require explicit sign-off.
- 🔒 Skills and decisions are stored locally in your browser.

## Where it lives

- `src/jack/evolve.ts` — skills store, improvement proposer, `deepThink()`
- **🧬 Evolve** tab in the UI — author skills, review proposals
- **🧠 Deep Think** toggle on the Console — show the reasoning trace

> The result: JACK keeps getting smarter and more capable over time — a real,
> safe, self-extending assistant rather than an empty promise.
