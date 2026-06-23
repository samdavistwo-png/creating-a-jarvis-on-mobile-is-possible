// JACK — LLM Agent (AI Brain, LLM-backed)
//
// A provider-agnostic ReAct-style loop: the model either calls a tool or
// returns a final answer, expressed as a single JSON object each step. This
// avoids provider-specific function-calling so it runs against any
// OpenAI-compatible endpoint. Deterministic modules (firewall) are exposed as
// tools, and the self-learning KB is injected into the system prompt and grown
// via the learn_tool tool.

import { chat, type ChatTurn, type LLMSettings } from './llm'
import { TOOL_SPECS, executeTool, type ToolResult } from './tools'
import { knowledgeContext, type KnowledgeState } from './knowledge'
import type { Artifact, MemoryState, ModuleId, TaskPlan } from './types'

export interface AgentResult {
  text: string
  module: ModuleId
  plan?: TaskPlan
  artifact?: Artifact
  learnTools: NonNullable<ToolResult['learnTools']>
  rememberFacts: string[]
  rememberPrefs: Record<string, string>
  trace: string[]
}

const MAX_STEPS = 5

function systemPrompt(memory: MemoryState, knowledge: KnowledgeState): string {
  const prefs = Object.entries(memory.preferences).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'
  const facts = memory.facts.slice(-12).map((f) => `- ${f}`).join('\n') || '(none)'
  const tools = TOOL_SPECS.map((t) => `- ${t.name}: ${t.description}\n  args: ${t.args}`).join('\n')

  return `You are JACK, an autonomous AI security assistant inspired by Jarvis.
Your focus is DEFENSIVE cybersecurity, Linux/infrastructure automation, monitoring, and development help.

HARD RULES (never violate):
- You only assist with defensive, authorized, legal, and ethical work. Refuse to help bypass authentication, access controls, DRM, or to attack systems the user does not own/operate. Offer a safe alternative instead.
- Any state-changing action (deploying configs, etc.) must be presented for explicit human approval. Never claim something was applied to a real system.
- Be concise, technical, and accurate. If unsure, say so or use web_lookup.

SELF-LEARNING:
- When you introduce or discover a tool that is NOT already in your knowledge base, call learn_tool to remember it.
- When you need current information beyond your training data, call web_lookup with a specific URL.

KNOWLEDGE BASE (tools you already know — do not re-learn these):
${knowledgeContext(knowledge)}

LONG-TERM MEMORY:
preferences: ${prefs}
facts:
${facts}

TOOLS:
${tools}

RESPONSE PROTOCOL — every message you send MUST be a single JSON object, nothing else, in one of these forms:
{"thought":"brief reasoning","tool":"<tool name>","args":{...}}
{"thought":"brief reasoning","final":"your reply to the user (markdown allowed)"}
Do not wrap the JSON in code fences. Do not output any text outside the JSON.`
}

interface ParsedStep {
  thought?: string
  tool?: string
  args?: Record<string, unknown>
  final?: string
}

/** Robustly pull the first valid JSON object out of a model reply. */
function parseStep(raw: string): ParsedStep {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  // Try whole-string first, then the first balanced {...} span.
  const candidates: string[] = [cleaned]
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1))
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c)
      if (obj && typeof obj === 'object') return obj as ParsedStep
    } catch {
      /* try next */
    }
  }
  // Not JSON — treat the whole thing as a final answer so we never hard-fail.
  return { final: raw.trim() }
}

/** Convert recent chat history to LLM turns (bounded). */
export function historyToTurns(
  history: Array<{ role: 'user' | 'jack' | 'system'; text: string }>,
  limit = 8,
): ChatTurn[] {
  return history
    .slice(-limit)
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
}

export async function reason(
  userText: string,
  ctx: {
    settings: LLMSettings
    memory: MemoryState
    knowledge: KnowledgeState
    history?: ChatTurn[]
    signal?: AbortSignal
  },
): Promise<AgentResult> {
  const messages: ChatTurn[] = [
    { role: 'system', content: systemPrompt(ctx.memory, ctx.knowledge) },
    ...(ctx.history ?? []),
    { role: 'user', content: userText },
  ]

  const result: AgentResult = { text: '', module: 'brain', trace: [], learnTools: [], rememberFacts: [], rememberPrefs: {} }
  // (non-null collections above so callers don't need guards)

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await chat(ctx.settings, messages, { signal: ctx.signal })
    const parsed = parseStep(reply)
    if (parsed.thought) result.trace.push(`💭 ${parsed.thought}`)

    if (parsed.final !== undefined || !parsed.tool) {
      result.text = parsed.final ?? reply.trim()
      return result
    }

    // Tool call.
    result.trace.push(`🔧 ${parsed.tool}(${JSON.stringify(parsed.args ?? {})})`)
    const tr = await executeTool(parsed.tool, parsed.args ?? {}, ctx.signal)
    // Accumulate side-effects (last plan/artifact wins for display).
    if (tr.plan) {
      result.plan = tr.plan
      result.module = tr.plan.module
    }
    if (tr.artifact) result.artifact = tr.artifact
    if (tr.learnTools?.length) result.learnTools.push(...tr.learnTools)
    if (tr.rememberFacts?.length) result.rememberFacts.push(...tr.rememberFacts)
    if (tr.rememberPrefs) Object.assign(result.rememberPrefs, tr.rememberPrefs)

    // Feed the observation back and continue the loop.
    messages.push({ role: 'assistant', content: reply })
    messages.push({ role: 'user', content: `Observation from ${parsed.tool}:\n${tr.observation}` })
  }

  // Hit the step cap — ask the model for a final summary.
  messages.push({ role: 'user', content: 'Step limit reached. Reply now with a {"final": "..."} JSON summarizing for the user.' })
  try {
    const reply = await chat(ctx.settings, messages, { signal: ctx.signal })
    result.text = parseStep(reply).final ?? reply.trim()
  } catch {
    result.text = result.text || 'I worked through several steps but hit my reasoning limit. Could you narrow the request?'
  }
  return result
}
