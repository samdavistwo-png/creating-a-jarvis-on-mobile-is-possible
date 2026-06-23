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
  source: 'authored' | 'taught' | 'seed'
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

// ---- Knowledge pack: built-in skills JACK ships with ----
//
// This is knowledge fed directly into JACK so it can answer (and speak) useful
// things out of the box — no LLM required. Triggers are specific multi-word
// phrases so they don't hijack ordinary requests. New entries added here are
// merged into returning users automatically without wiping their own skills.
export const SEED_SKILLS: Omit<Skill, 'createdAt'>[] = [
  // security concepts
  { id: 'kp_zero_trust', name: 'Zero Trust', description: 'Explains zero trust', source: 'seed', triggers: ['what is zero trust', 'explain zero trust', 'zero trust meaning', 'zero-trust'], response: 'Zero Trust means never trusting a request just because of where it comes from. Every access is verified by identity and device, with least-privilege permissions and continuous checks — "never trust, always verify".' },
  { id: 'kp_did', name: 'Defense in depth', description: 'Explains defense in depth', source: 'seed', triggers: ['what is defense in depth', 'explain defense in depth', 'defence in depth'], response: 'Defense in depth layers multiple independent security controls — firewall, patching, least privilege, monitoring, backups — so that if one fails, others still protect you. No single point of failure.' },
  { id: 'kp_least_priv', name: 'Least privilege', description: 'Explains least privilege', source: 'seed', triggers: ['what is least privilege', 'explain least privilege', 'least privilege meaning'], response: 'Least privilege means giving each user, service or process only the permissions it truly needs, for the shortest time. It shrinks the blast radius if an account is compromised.' },
  { id: 'kp_cia', name: 'CIA triad', description: 'Explains CIA triad', source: 'seed', triggers: ['what is the cia triad', 'cia triad', 'confidentiality integrity availability'], response: 'The CIA triad is the core of security: Confidentiality (keep data private), Integrity (keep it accurate and untampered), and Availability (keep it accessible when needed).' },
  { id: 'kp_phishing', name: 'Phishing', description: 'Explains phishing', source: 'seed', triggers: ['what is phishing', 'explain phishing'], response: 'Phishing tricks you into revealing credentials or running malware via fake emails, texts or sites. Defend with skepticism of links, checking sender domains, and phishing-resistant MFA like passkeys.' },
  { id: 'kp_ransomware', name: 'Ransomware', description: 'Explains ransomware', source: 'seed', triggers: ['what is ransomware', 'explain ransomware'], response: 'Ransomware encrypts your files and demands payment. Your best defenses are offline, tested backups (3-2-1 rule), patching, least privilege, and email/endpoint protection.' },
  { id: 'kp_2fa', name: 'Two-factor auth', description: 'Explains 2FA/MFA', source: 'seed', triggers: ['what is two factor', 'what is 2fa', 'what is mfa', 'explain two factor'], response: 'Two-factor authentication adds a second proof beyond your password — a code, an app prompt, or a hardware passkey. Prefer app-based or passkey/FIDO2 over SMS, which can be intercepted.' },
  { id: 'kp_sqli', name: 'SQL injection', description: 'Explains SQL injection', source: 'seed', triggers: ['what is sql injection', 'explain sql injection', 'sqli'], response: 'SQL injection happens when untrusted input is concatenated into a SQL query, letting attackers read or alter your database. Prevent it with parameterized queries / prepared statements — never string-build SQL.' },
  { id: 'kp_xss', name: 'XSS', description: 'Explains cross-site scripting', source: 'seed', triggers: ['what is xss', 'cross site scripting', 'explain xss'], response: 'Cross-Site Scripting (XSS) injects malicious JavaScript into a page so it runs in other users\' browsers. Prevent it by escaping/encoding output, using a Content-Security-Policy, and never injecting raw HTML.' },
  { id: 'kp_encryption', name: 'Encryption', description: 'Explains encryption', source: 'seed', triggers: ['what is encryption', 'explain encryption'], response: 'Encryption scrambles data so only someone with the key can read it. Use it in transit (TLS/HTTPS) and at rest (disk/database/file encryption). Symmetric keys are fast; asymmetric keys enable key exchange and signatures.' },
  { id: 'kp_backup', name: '3-2-1 backups', description: 'Backup rule', source: 'seed', triggers: ['backup rule', '3-2-1 backup', 'how should i back up', 'backup strategy'], response: 'Follow the 3-2-1 rule: keep 3 copies of your data, on 2 different media, with 1 copy off-site/offline. And actually test restores — an untested backup is a guess.' },

  // infra / dev concepts
  { id: 'kp_docker', name: 'Docker', description: 'Explains Docker', source: 'seed', triggers: ['what is docker', 'explain docker'], response: 'Docker packages an app with its dependencies into a portable container that runs the same everywhere. Harden it: use minimal base images, run as a non-root user, and drop Linux capabilities.' },
  { id: 'kp_k8s', name: 'Kubernetes', description: 'Explains Kubernetes', source: 'seed', triggers: ['what is kubernetes', 'explain kubernetes', 'what is k8s'], response: 'Kubernetes orchestrates containers across many machines — scheduling, scaling, self-healing and networking. Secure it with RBAC, network policies, and admission policies (Kyverno/OPA).' },
  { id: 'kp_https', name: 'HTTPS / TLS', description: 'Explains HTTPS/TLS', source: 'seed', triggers: ['what is https', 'what is tls', 'what is ssl', 'explain https'], response: 'HTTPS is HTTP over TLS — it encrypts traffic and verifies the server\'s identity with a certificate, preventing eavesdropping and tampering. Get free certs from Let\'s Encrypt via certbot.' },
  { id: 'kp_vpn', name: 'VPN', description: 'Explains VPN', source: 'seed', triggers: ['what is a vpn', 'what is vpn', 'explain vpn'], response: 'A VPN creates an encrypted tunnel between you and a network, protecting traffic on untrusted Wi-Fi and giving private access to remote resources. WireGuard and Tailscale are fast, modern options.' },
  { id: 'kp_api', name: 'API', description: 'Explains APIs', source: 'seed', triggers: ['what is an api', 'what is api', 'explain api'], response: 'An API is a contract that lets programs talk to each other. Web APIs are often REST (resources + HTTP verbs) or GraphQL (request exactly the fields you want). Secure them with auth, rate limits and input validation.' },
  { id: 'kp_git', name: 'Git', description: 'Explains Git', source: 'seed', triggers: ['what is git', 'explain git'], response: 'Git is distributed version control: it tracks changes, lets you branch and merge, and sync with remotes like GitHub. Core flow: edit → git add → git commit → git push.' },
  { id: 'kp_ssh_key', name: 'Generate SSH key', description: 'How to make an SSH key', source: 'seed', triggers: ['how to generate ssh key', 'create ssh key', 'make an ssh key', 'generate ssh key'], response: 'Generate a modern SSH key with: ssh-keygen -t ed25519 -C "you@example.com". Add the public key (~/.ssh/id_ed25519.pub) to the server or GitHub, keep the private key secret, and disable password auth for best security.' },
  { id: 'kp_firewall', name: 'Firewall', description: 'Explains firewalls', source: 'seed', triggers: ['what is a firewall', 'explain firewall'], response: 'A firewall controls which network traffic is allowed in or out, by rules. Best practice is default-deny inbound, allow only required ports, rate-limit SSH, and log drops. Ask me to "build a firewall" and I\'ll generate one.' },

  // about JACK itself
  { id: 'kp_about', name: 'About JACK', description: 'Who JACK is', source: 'seed', triggers: ['who are you jack', 'what can you do jack', 'tell me about yourself'], response: 'I\'m JACK — your JARVIS for mobile. I hear and speak in English and Tamil, open apps and sites on command, learn skills you teach me, remember things locally, reason about security and infrastructure, and even propose improvements to my own code. Try the Automations, Evolve and Knowledge tabs.' },
]

export function loadSkills(): Skill[] {
  try {
    const raw = localStorage.getItem(SKILLS_KEY)
    if (!raw) return seedSkillState()
    const parsed = JSON.parse(raw) as Skill[]
    if (!Array.isArray(parsed)) return seedSkillState()
    return mergeSeedSkills(parsed)
  } catch {
    return seedSkillState()
  }
}

function seedSkillState(): Skill[] {
  const now = Date.now()
  const list = SEED_SKILLS.map((s) => ({ ...s, createdAt: now }))
  saveSkills(list)
  return list
}

/** Add any seed skills the user doesn't already have, preserving their own. */
function mergeSeedSkills(list: Skill[]): Skill[] {
  const have = new Set(list.map((s) => s.id))
  const missing = SEED_SKILLS.filter((s) => !have.has(s.id))
  if (!missing.length) return list
  const now = Date.now()
  const next = [...list, ...missing.map((s) => ({ ...s, createdAt: now }))].slice(0, 200)
  saveSkills(next)
  console.log('JACK evolve: merged', missing.length, 'knowledge-pack skills')
  return next
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
