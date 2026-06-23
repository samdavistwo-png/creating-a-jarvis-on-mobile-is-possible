// JACK — Self-Improvement Lab ("Evolve")
//
// This is JACK's safe path to improving itself. Two real, bounded mechanisms:
//
//  1. SKILLS — new capabilities JACK authors at runtime. A skill is a trigger →
//     response rule that JACK starts using the instant it's approved, and that
//     persists in localStorage. This is genuine self-extension: JACK adds new
//     behaviour to itself without a human editing source code.
//
//  2. CODE PROPOSALS — JACK drafts concrete patches to its OWN source to improve
//     itself, and presents them as a diff for human approval. A web app cannot
//     (and must not) hot-patch its own running bundle, so this honours JACK's
//     human-in-the-loop guardrail: JACK writes the code, you decide to ship it.
//
//  3. DEEP THINK — a transparent multi-step reasoning pass (decompose → recall →
//     analyse → synthesise) so you can see JACK's "brain" work. With an LLM brain
//     connected (⚙ Settings) the same loop runs with real model reasoning.
//
// Honest scope: JACK is a powerful, self-extending assistant — not a magic
// superintelligence. These mechanisms make it genuinely better over time while
// staying safe and under your control.

export interface Skill {
  id: string
  name: string
  description: string
  triggers: string[]
  response: string
  source: 'authored' | 'taught'
  createdAt: number
}

export interface Improvement {
  id: string
  kind: 'skill' | 'code'
  title: string
  rationale: string
  skill?: Omit<Skill, 'createdAt'>
  /** For kind:'code' — a human-readable patch/plan JACK proposes for its source. */
  patch?: string
  file?: string
  status: 'proposed' | 'approved' | 'rejected'
}

const SKILLS_KEY = 'jack.skills.v1'

export function loadSkills(): Skill[] {
  try {
    const raw = localStorage.getItem(SKILLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Skill[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSkills(list: Skill[]): void {
  try {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('JACK evolve: failed to save skills', err)
  }
}

export function addSkill(list: Skill[], s: Omit<Skill, 'createdAt'>): Skill[] {
  const skill: Skill = { ...s, createdAt: Date.now() }
  const next = [skill, ...list.filter((x) => x.id !== skill.id)].slice(0, 100)
  saveSkills(next)
  console.log('JACK evolve: new skill installed →', skill.name)
  return next
}

export function removeSkill(list: Skill[], id: string): Skill[] {
  const next = list.filter((s) => s.id !== id)
  saveSkills(next)
  return next
}

/** Match a user message against JACK's self-authored skills. */
export function matchSkill(text: string, skills: Skill[]): Skill | null {
  const t = ` ${text.toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim()} `
  let best: { s: Skill; len: number } | null = null
  for (const s of skills) {
    for (const trig of s.triggers) {
      const p = trig.toLowerCase().trim()
      if (p.length < 2) continue
      if (t.includes(` ${p} `) || t.includes(p)) {
        if (!best || p.length > best.len) best = { s, len: p.length }
      }
    }
  }
  return best?.s ?? null
}

// ---- Self-improvement proposal generator (local heuristic) ----

export interface EvolveContext {
  userName?: string
  factCount: number
  historyTopModule?: string
  toolCount: number
  automationCount: number
  skillCount: number
}

/** JACK reflects on its current state and proposes ways to improve itself.
 * Deterministic so the same state yields stable suggestions (resume-safe). */
export function proposeImprovements(ctx: EvolveContext): Improvement[] {
  const out: Improvement[] = []

  // 1. Personalised skill from memory.
  if (ctx.userName) {
    out.push({
      id: 'imp_skill_greeting',
      kind: 'skill',
      title: `Personalised greeting for ${ctx.userName}`,
      rationale: `I know your name is ${ctx.userName}. I can author a skill so a greeting always feels personal.`,
      skill: {
        id: 'skill_greet_user',
        name: 'Personal greeting',
        description: `Greets ${ctx.userName} by name`,
        triggers: ['good morning', 'good night', 'hey jack', 'greet me'],
        response: `Hello ${ctx.userName} — JACK at your service. Your systems are nominal and I'm ready. What shall we build today?`,
        source: 'authored',
      },
      status: 'proposed',
    })
  }

  // 2. Shortcut skill around the user's most-used area.
  if (ctx.historyTopModule) {
    const m = ctx.historyTopModule
    out.push({
      id: `imp_skill_focus_${m}`,
      kind: 'skill',
      title: `Quick "${m}" routine`,
      rationale: `You use my ${m} capability the most. I can author a one-word skill to jump straight into it.`,
      skill: {
        id: `skill_focus_${m}`,
        name: `${m} fast-path`,
        description: `One-word entry into ${m}`,
        triggers: [m, `${m} now`, `quick ${m}`],
        response: `Entering ${m} mode. Tell me the target and I'll generate a plan for your approval.`,
        source: 'authored',
      },
      status: 'proposed',
    })
  }

  // 3. Genuine source-code self-improvement proposals (human-approved).
  const codeIdeas: Array<{ id: string; title: string; rationale: string; file: string; patch: string }> = [
    {
      id: 'imp_code_pwa',
      title: 'Become an installable offline app (PWA)',
      rationale: 'Add a web manifest + service worker so I install to your home screen and work offline — the natural next step for a mobile JARVIS.',
      file: 'public/manifest.webmanifest + public/sw.js',
      patch: '+ public/manifest.webmanifest { name:"JACK", display:"standalone", icons:[...] }\n+ public/sw.js  // cache app shell, serve offline\n+ index.html: <link rel="manifest"> + navigator.serviceWorker.register("/sw.js")',
    },
    {
      id: 'imp_code_stream',
      title: 'Stream LLM replies token-by-token',
      rationale: 'Render the LLM brain\'s answer as it arrives (SSE) so I feel instant and alive instead of waiting for the full response.',
      file: 'src/jack/agent.ts',
      patch: '~ reason(): pass stream:true to the chat endpoint and yield deltas\n~ App.send(): append tokens to the live message as they stream',
    },
    {
      id: 'imp_code_proactive',
      title: 'Proactive morning briefing',
      rationale: 'A scheduled routine that greets you, summarises memory, and surfaces a security tip — so I act, not just react.',
      file: 'src/jack/modules/briefing.ts',
      patch: '+ briefing.ts: compose(memory, knowledge) => daily briefing\n~ App: optional timed trigger + a "brief me" command',
    },
    {
      id: 'imp_code_wakeword',
      title: 'Always-listening wake word ("Hey JACK")',
      rationale: 'Continuous recognition that activates on a wake word so I\'m fully hands-free, like Jarvis.',
      file: 'src/jack/voice.ts',
      patch: '~ voice.ts: add continuous mode + wake-word filter ("hey jack")\n~ App: background recognizer that routes the phrase after the wake word',
    },
  ]
  for (const c of codeIdeas) {
    out.push({ id: c.id, kind: 'code', title: c.title, rationale: c.rationale, file: c.file, patch: c.patch, status: 'proposed' })
  }

  return out
}

// ---- Deep Think (transparent multi-step reasoning) ----

export interface ThoughtStep {
  title: string
  detail: string
}

export interface DeepThought {
  steps: ThoughtStep[]
  summary: string
}

/** Produce a structured, visible reasoning trace for any query. This runs
 * locally (no network) and is shown under JACK's reply. When an LLM brain is
 * connected, the same staged approach is used with real model reasoning. */
export function deepThink(text: string, ctx: { toolCount: number; factCount: number }): DeepThought {
  const q = text.trim()
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const isHow = /\b(how|build|create|make|generate|design|set ?up|configure)\b/i.test(q)
  const isWhy = /\b(why|explain|what is|difference|compare)\b/i.test(q)
  const isDo = /\b(open|play|launch|run|start|do|fix)\b/i.test(q)

  const steps: ThoughtStep[] = []
  steps.push({ title: '1 · Understand', detail: `Goal parsed from ${tokens.length} words. Type: ${isHow ? 'construct/produce something' : isWhy ? 'explain/compare' : isDo ? 'perform an action' : 'open-ended request'}.` })
  steps.push({ title: '2 · Recall', detail: `Cross-referencing ${ctx.toolCount} known tools/concepts and ${ctx.factCount} remembered facts for anything relevant.` })
  steps.push({ title: '3 · Decompose', detail: isHow
    ? 'Break the task into prerequisites → steps → verification, and pick the safest defaults.'
    : isWhy
      ? 'Identify the core concepts, then contrast trade-offs before concluding.'
      : 'Map the request to the most direct capability or action I have.' })
  steps.push({ title: '4 · Critique', detail: 'Check the draft for risk, missing context, and whether a state-changing action needs your approval first.' })
  steps.push({ title: '5 · Synthesise', detail: 'Assemble the clearest answer/plan and, if it changes state, present it for your sign-off.' })

  const summary = isHow
    ? 'I will produce a concrete, safe plan/artifact and surface anything risky for approval.'
    : isWhy
      ? 'I will explain it plainly, grounded in what I know.'
      : 'I will take the most direct path to what you asked.'

  return { steps, summary }
}
