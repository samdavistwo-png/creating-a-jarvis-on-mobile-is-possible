// JACK — shared types
// Core domain model for the JACK autonomous security assistant.

export type Role = 'user' | 'jack' | 'system'

export type ModuleId =
  | 'brain'
  | 'cyber-defense'
  | 'infra'
  | 'developer'
  | 'monitor'
  | 'memory'

export interface ChatMessage {
  id: string
  role: Role
  text: string
  ts: number
  /** Optional structured payload attached to a JACK message. */
  plan?: TaskPlan
  artifact?: Artifact
  module?: ModuleId
  /** LLM reasoning/tool-call trace, shown collapsed under a JACK message. */
  trace?: string[]
}

/** A multi-step plan produced by the brain for a single user request. */
export interface TaskPlan {
  id: string
  intent: string
  summary: string
  module: ModuleId
  steps: PlanStep[]
  /** True when the plan performs a state-changing action needing sign-off. */
  requiresApproval: boolean
  status: 'proposed' | 'approved' | 'rejected' | 'executed'
  artifact?: Artifact
}

export interface PlanStep {
  label: string
  detail?: string
}

/** A concrete deliverable JACK produces (e.g. a firewall config). */
export interface Artifact {
  kind: 'firewall-config' | 'report' | 'note'
  title: string
  language?: string
  content: string
}

export interface MemoryState {
  preferences: Record<string, string>
  facts: string[]
  history: HistoryEntry[]
}

export interface HistoryEntry {
  ts: number
  intent: string
  summary: string
  module: ModuleId
}

/** Result returned by a brain module handler. */
export interface BrainResponse {
  text: string
  module: ModuleId
  plan?: TaskPlan
  artifact?: Artifact
  /** Facts/preferences the brain learned and wants persisted. */
  remember?: { facts?: string[]; preferences?: Record<string, string> }
}
