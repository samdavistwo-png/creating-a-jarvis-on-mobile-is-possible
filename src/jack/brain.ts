// JACK — AI Brain Layer
// Natural-language understanding → intent classification → task planning →
// module dispatch. This is a deterministic, fully local reasoning engine: no
// network calls, no API keys. It is structured so the classify/plan stage can
// later be backed by an LLM without changing the module contracts.

import type { BrainResponse, MemoryState, ModuleId } from './types'
import { generateFirewall } from './modules/firewall'
import { generateInfra } from './modules/infra'
import { describeMonitoring } from './modules/monitor'

type Intent =
  | 'greeting'
  | 'capabilities'
  | 'firewall'
  | 'infra'
  | 'monitor'
  | 'hardening'
  | 'recall'
  | 'remember'
  | 'identity'
  | 'thanks'
  | 'unknown'

interface Classification {
  intent: Intent
  confidence: number
}

const RULES: Array<{ intent: Intent; re: RegExp; weight: number }> = [
  { intent: 'greeting', re: /\b(hi|hello|hey|yo|good (morning|evening|afternoon))\b/i, weight: 1 },
  { intent: 'thanks', re: /\b(thanks|thank you|cheers|appreciate)\b/i, weight: 1 },
  { intent: 'identity', re: /\b(who are you|your name|what are you|are you jarvis|are you jack)\b/i, weight: 2 },
  { intent: 'capabilities', re: /\b(help|what can you do|capabilities|commands|features|how do you work)\b/i, weight: 2 },
  { intent: 'firewall', re: /\b(firewall|ufw|iptables|nftables|block port|allow port|open port|close port|harden.*(server|network|firewall))\b/i, weight: 3 },
  { intent: 'infra', re: /\b(dockerfile|docker-compose|docker compose|compose file|container(ize)?|nginx|reverse.?proxy|systemd|service unit|terraform|iac|deploy(ment)?|kubernetes|k8s)\b/i, weight: 3 },
  { intent: 'monitor', re: /\b(monitor|watch|cpu|memory|ram|disk space|disk usage|telemetry|metrics|alert me|notify me)\b/i, weight: 3 },
  { intent: 'hardening', re: /\b(harden|secure|security (advice|recommendation|best practice)|lock down|baseline)\b/i, weight: 2 },
  { intent: 'recall', re: /\b(what do you (know|remember)|my preferences|recall|memory|history)\b/i, weight: 2 },
  { intent: 'remember', re: /\b(remember that|note that|my name is|i prefer|store this)\b/i, weight: 3 },
]

export function classify(text: string): Classification {
  let best: Classification = { intent: 'unknown', confidence: 0 }
  for (const r of RULES) {
    if (r.re.test(text)) {
      if (r.weight > best.confidence) best = { intent: r.intent, confidence: r.weight }
    }
  }
  return best
}

const HARDENING_CHECKLIST = [
  'Disable password SSH auth — use key-based auth only (`PasswordAuthentication no`).',
  'Enable automatic security updates (`unattended-upgrades`).',
  'Run a default-deny firewall — ask me to "build a firewall" and I will generate one.',
  'Install fail2ban to throttle repeated failed logins.',
  'Remove unused packages and disable services you do not need.',
  'Enforce least-privilege sudo and audit `/etc/sudoers`.',
  'Enable auditd + centralised logging for tamper-evident records.',
  'Keep encrypted, tested backups (3-2-1 rule).',
]

function tryRemember(text: string): BrainResponse | null {
  const prefs: Record<string, string> = {}
  const facts: string[] = []

  const nameMatch = text.match(/my name is\s+([A-Za-z][\w .'-]{0,40})/i)
  if (nameMatch?.[1]) prefs.userName = nameMatch[1].trim()

  const prefMatch = text.match(/i prefer\s+(.{2,80})/i)
  if (prefMatch?.[1]) facts.push(`User prefers ${prefMatch[1].trim()}`)

  const noteMatch = text.match(/(?:remember that|note that|store this[:,]?)\s+(.{2,120})/i)
  if (noteMatch?.[1]) facts.push(noteMatch[1].trim())

  if (!Object.keys(prefs).length && !facts.length) return null

  const what = [
    prefs.userName ? `your name is **${prefs.userName}**` : null,
    ...facts.map((f) => `"${f}"`),
  ]
    .filter(Boolean)
    .join(', ')

  return {
    text: `Got it — I'll remember ${what}. It's stored locally in your browser and you can export or wipe it from the Memory panel any time.`,
    module: 'memory',
    remember: { preferences: prefs, facts },
  }
}

export function think(text: string, memory: MemoryState): BrainResponse {
  const trimmed = text.trim()
  const { intent } = classify(trimmed)
  const name = memory.preferences.userName

  switch (intent) {
    case 'firewall':
      return generateFirewall(trimmed)

    case 'infra':
      return generateInfra(trimmed)

    case 'monitor':
      return {
        text: describeMonitoring(),
        module: 'monitor',
        remember: { facts: ['Enabled live system monitoring'] },
      }

    case 'remember': {
      const r = tryRemember(trimmed)
      if (r) return r
      return {
        text: 'Tell me what to remember — e.g. "remember that the prod server is in eu-west-1" or "my name is Sam".',
        module: 'memory',
      }
    }

    case 'recall': {
      const prefs = Object.entries(memory.preferences)
      const lines: string[] = []
      if (prefs.length) lines.push('**Preferences:** ' + prefs.map(([k, v]) => `${k}=${v}`).join(', '))
      if (memory.facts.length) lines.push('**Facts I know:**\n' + memory.facts.map((f) => `• ${f}`).join('\n'))
      if (memory.history.length)
        lines.push(`**Recent actions:** ${memory.history.length} recorded (see the Memory panel).`)
      return {
        text: lines.length ? lines.join('\n\n') : "I don't have anything stored yet. Ask me to remember something.",
        module: 'memory',
      }
    }

    case 'hardening':
      return {
        text:
          'Here is a defensive hardening baseline I recommend:\n\n' +
          HARDENING_CHECKLIST.map((c, i) => `${i + 1}. ${c}`).join('\n'),
        module: 'cyber-defense',
        remember: { facts: ['Requested security hardening baseline'] },
      }

    case 'capabilities':
      return { text: capabilities(), module: 'brain' }

    case 'identity':
      return {
        text:
          "I'm **JACK** — your autonomous AI security assistant, inspired by Jarvis. I focus on " +
          'defensive cybersecurity, infrastructure automation, monitoring, and development support. ' +
          'I always work within ethical and legal boundaries and ask for your approval before any ' +
          'state-changing action. Ask me what I can do for the full list.',
        module: 'brain',
      }

    case 'greeting':
      return {
        text: `${name ? `Welcome back, ${name}.` : 'Hello.'} JACK online and ready. ` +
          'I can build firewalls, monitor your system, and advise on hardening. What do you need?',
        module: 'brain',
      }

    case 'thanks':
      return { text: "Any time. I'm standing by.", module: 'brain' }

    default:
      return {
        text:
          "I didn't map that to a known action yet. I'm strongest at defensive security right now. " +
          'Try:\n• "Build a strong firewall for my server (ssh + https)"\n• "Monitor my system"\n' +
          '• "Give me a hardening checklist"\n• "Remember that ..."\n\nType **help** for the full list.',
        module: 'brain',
      }
  }
}

export function capabilities(): string {
  return [
    "**JACK — what I can do today** (defensive, human-supervised):",
    '',
    '🛡️ **Cyber Defense** — generate hardened firewalls (ufw / iptables / nftables) with default-deny',
    'policy, SSH rate-limiting, and logging. Also: security hardening baselines.',
    '',
    '🏗️ **Infrastructure** — generate hardened Dockerfiles, docker-compose, nginx reverse proxies',
    '(TLS + security headers), sandboxed systemd units, and Terraform skeletons.',
    '',
    '📊 **Monitoring** — live CPU / memory / disk / network telemetry with alert thresholds.',
    '',
    '🧠 **Memory + 📚 self-learning** — I remember preferences/facts/history and learn new tools',
    '(taught by you or discovered via the LLM), persisted across sessions.',
    '',
    '✅ **Human-in-the-loop** — any state-changing action is proposed as a plan you must approve.',
    '',
    '_Connect an LLM in ⚙ Settings for free-form reasoning, web look-ups, and autonomous tool use._',
  ].join('\n')
}

export const MODULE_META: Record<ModuleId, { label: string; color: string }> = {
  brain: { label: 'AI Brain', color: '#38bdf8' },
  'cyber-defense': { label: 'Cyber Defense', color: '#f87171' },
  infra: { label: 'Infrastructure', color: '#a78bfa' },
  developer: { label: 'Developer', color: '#34d399' },
  monitor: { label: 'Monitoring', color: '#fbbf24' },
  memory: { label: 'Memory', color: '#22d3ee' },
}
