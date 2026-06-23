// JACK — Tool registry & execution
//
// Tools the LLM brain can invoke in its reasoning loop. Each tool returns an
// `observation` string (fed back to the model) plus optional structured
// side-effects the UI/memory/KB consume. Provider-agnostic and client-side.

import type { Artifact, TaskPlan } from './types'
import { generateFirewall } from './modules/firewall'
import { generateInfra } from './modules/infra'
import type { KnownTool } from './knowledge'

export interface ToolResult {
  observation: string
  plan?: TaskPlan
  artifact?: Artifact
  learnTools?: Array<Partial<KnownTool> & { name: string; summary: string }>
  rememberFacts?: string[]
  rememberPrefs?: Record<string, string>
}

export interface ToolSpec {
  name: string
  description: string
  args: string
}

// Declared to the model in the system prompt.
export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'generate_firewall',
    description:
      'Generate a hardened, default-deny firewall config (ufw/iptables/nftables) from a request. Use for any firewall/hardening ask.',
    args: '{ "request": "free-text describing services/ports/backend, e.g. \\"ufw allowing ssh and https\\"" }',
  },
  {
    name: 'generate_infra',
    description:
      'Generate a hardened infrastructure artifact from a request: Dockerfile, docker-compose, nginx reverse proxy, systemd unit, or Terraform. Use for containerization/deployment/proxy/service-config asks.',
    args: '{ "request": "free-text, e.g. \\"dockerfile for a node app on port 3000\\" or \\"nginx reverse proxy for api.example.com to port 8080\\"" }',
  },
  {
    name: 'web_lookup',
    description:
      'Fetch the readable content of a URL to get UP-TO-DATE information (docs, release notes, advisories). Use when you need current facts beyond your training data.',
    args: '{ "url": "https://..." }',
  },
  {
    name: 'learn_tool',
    description:
      'Persist a NEW security/Linux/dev tool you just learned about so you remember it next time. Use after discovering or being told about a tool.',
    args: '{ "name": "...", "category": "...", "summary": "...", "usage": "optional example" }',
  },
  {
    name: 'remember',
    description: 'Store a durable fact or user preference in long-term memory.',
    args: '{ "fact": "optional fact string", "key": "optional pref key", "value": "optional pref value" }',
  },
]

/** Fetch readable page content via Jina Reader (CORS-enabled, no key needed). */
async function webLookup(url: string, signal?: AbortSignal): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return `web_lookup error: "${url}" is not a valid http(s) URL.`
  try {
    const res = await fetch('https://r.jina.ai/' + url, { signal, headers: { Accept: 'text/plain' } })
    if (!res.ok) return `web_lookup error: HTTP ${res.status} fetching ${url}.`
    const text = await res.text()
    const trimmed = text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 3500)
    return `Fetched ${url} (truncated):\n${trimmed}`
  } catch (err) {
    return `web_lookup error: ${err instanceof Error ? err.message : 'request failed'} (the page may block cross-origin reads).`
  }
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolResult> {
  switch (name) {
    case 'generate_firewall': {
      const req = String(args.request ?? '')
      const r = generateFirewall(req || 'ssh and https with ufw')
      return {
        observation: `Generated ${r.plan?.summary ?? 'a firewall config'}. It is shown to the user as an approvable plan (not yet applied).`,
        plan: r.plan,
        artifact: r.artifact,
        learnTools: [],
        rememberFacts: r.remember?.facts,
        rememberPrefs: r.remember?.preferences,
      }
    }
    case 'generate_infra': {
      const req = String(args.request ?? '')
      const r = generateInfra(req || 'dockerfile for a node app')
      return {
        observation: `Generated ${r.plan?.summary ?? 'an infrastructure artifact'}. Shown to the user as an approvable plan (not yet applied).`,
        plan: r.plan,
        artifact: r.artifact,
        rememberFacts: r.remember?.facts,
        rememberPrefs: r.remember?.preferences,
      }
    }
    case 'web_lookup': {
      const obs = await webLookup(String(args.url ?? ''), signal)
      return { observation: obs }
    }
    case 'learn_tool': {
      const t = {
        name: String(args.name ?? '').trim(),
        category: String(args.category ?? 'general').trim(),
        summary: String(args.summary ?? '').trim(),
        usage: args.usage ? String(args.usage).trim() : undefined,
      }
      if (!t.name || !t.summary) return { observation: 'learn_tool error: name and summary are required.' }
      return { observation: `Learned tool "${t.name}" — stored in the knowledge base.`, learnTools: [t] }
    }
    case 'remember': {
      const facts: string[] = []
      const prefs: Record<string, string> = {}
      if (args.fact) facts.push(String(args.fact))
      if (args.key && args.value) prefs[String(args.key)] = String(args.value)
      if (!facts.length && !Object.keys(prefs).length)
        return { observation: 'remember error: provide a fact or key/value.' }
      return { observation: 'Stored to long-term memory.', rememberFacts: facts, rememberPrefs: prefs }
    }
    default:
      return { observation: `Unknown tool "${name}".` }
  }
}
