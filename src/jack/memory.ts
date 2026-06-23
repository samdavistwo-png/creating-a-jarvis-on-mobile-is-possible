// JACK — Memory System
// Persists user preferences, learned facts, and task history to localStorage.
// All memory is local to the browser and can be exported or wiped by the user.

import type { MemoryState, HistoryEntry } from './types'

const KEY = 'jack.memory.v1'

const EMPTY: MemoryState = { preferences: {}, facts: [], history: [] }

export function loadMemory(): MemoryState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    const parsed = JSON.parse(raw) as MemoryState
    return {
      preferences: parsed.preferences ?? {},
      facts: parsed.facts ?? [],
      history: parsed.history ?? [],
    }
  } catch (err) {
    console.warn('JACK memory: failed to load, starting fresh', err)
    return structuredClone(EMPTY)
  }
}

export function saveMemory(state: MemoryState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('JACK memory: failed to save', err)
  }
}

export function rememberFacts(state: MemoryState, facts: string[]): MemoryState {
  const set = new Set(state.facts)
  for (const f of facts) {
    const clean = f.trim()
    if (clean) set.add(clean)
  }
  // Keep the most recent 50 facts to bound storage.
  const next = { ...state, facts: Array.from(set).slice(-50) }
  saveMemory(next)
  return next
}

export function rememberPreferences(
  state: MemoryState,
  prefs: Record<string, string>,
): MemoryState {
  const next = { ...state, preferences: { ...state.preferences, ...prefs } }
  saveMemory(next)
  return next
}

export function recordHistory(state: MemoryState, entry: HistoryEntry): MemoryState {
  // Keep the most recent 100 actions.
  const history = [...state.history, entry].slice(-100)
  const next = { ...state, history }
  saveMemory(next)
  return next
}

export function clearMemory(): MemoryState {
  saveMemory(EMPTY)
  return structuredClone(EMPTY)
}

export function exportMemory(state: MemoryState): string {
  return JSON.stringify(state, null, 2)
}
