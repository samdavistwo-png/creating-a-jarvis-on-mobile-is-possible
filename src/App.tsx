import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, MemoryState, TaskPlan, ModuleId } from './jack/types'
import { think, capabilities, MODULE_META } from './jack/brain'
import { reason, historyToTurns } from './jack/agent'
import {
  loadMemory,
  rememberFacts,
  rememberPreferences,
  recordHistory,
  clearMemory,
  exportMemory,
} from './jack/memory'
import {
  loadKnowledge,
  learnTools,
  forgetTool,
  type KnowledgeState,
} from './jack/knowledge'
import {
  loadSettings,
  saveSettings,
  isConfigured,
  testConnection,
  PROVIDER_PRESETS,
  type LLMSettings,
} from './jack/llm'
import { initialTelemetry, tickTelemetry, type Telemetry } from './jack/modules/monitor'
import {
  loadAutomations,
  addAutomation,
  removeAutomation,
  matchAutomation,
  isOpenIntent,
  runAutomation,
  parseTaughtAutomation,
  BUILTIN,
  type Automation,
} from './jack/automations'
import {
  LANGS,
  createRecognizer,
  sttSupported,
  ttsSupported,
  speak,
  stopSpeaking,
  warmVoices,
  type Lang,
  type Recognizer,
} from './jack/voice'
import {
  loadSkills,
  addSkill,
  removeSkill,
  matchSkill,
  proposeImprovements,
  deepThink,
  type Skill,
  type Improvement,
  type EvolveContext,
} from './jack/evolve'
import { JACK_CSS } from './jack/ui.css'

type Tab = 'console' | 'automations' | 'evolve' | 'dashboard' | 'memory' | 'knowledge'

const uid = () => `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <div key={i} style={{ minHeight: line ? undefined : '0.6em' }}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong key={j} style={{ color: 'var(--cyan)' }}>{p.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{p}</span>
              ),
            )}
          </div>
        )
      })}
    </>
  )
}

function Trace({ trace }: { trace: string[] }) {
  const [open, setOpen] = useState(false)
  if (!trace.length) return null
  return (
    <div style={{ marginTop: 8 }}>
      <span onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer' }}>
        {open ? '▾' : '▸'} reasoning ({trace.length})
      </span>
      {open && (
        <div className="jack-mono" style={{ marginTop: 6, fontSize: 11.5, color: 'var(--muted)', borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
          {trace.map((t, i) => <div key={i} style={{ padding: '2px 0' }}>{t}</div>)}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, onApprove, onReject }: { plan: TaskPlan; onApprove: () => void; onReject: () => void }) {
  const meta = MODULE_META[plan.module]
  const decided = plan.status !== 'proposed'
  return (
    <div style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, background: 'rgba(2,8,18,0.45)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'rgba(56,189,248,0.05)' }}>
        <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>◆ {meta.label}</span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>· task plan</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{plan.intent}</span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
          {plan.steps.map((s, i) => (
            <li key={i}>{s.label}{s.detail && <span style={{ color: 'var(--muted)' }}> — {s.detail}</span>}</li>
          ))}
        </ol>
        {plan.artifact && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>📄 {plan.artifact.title}</div>
            <pre className="jack-code jack-mono"><code>{plan.artifact.content}</code></pre>
          </div>
        )}
        {plan.requiresApproval && !decided && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--warn)', marginRight: 'auto' }}>⚠ Human approval required — nothing applied.</span>
            <button className="jack-btn danger" onClick={onReject}>Reject</button>
            <button className="jack-btn primary" onClick={onApprove}>Approve &amp; deploy</button>
          </div>
        )}
        {decided && (
          <div style={{ marginTop: 12, fontSize: 13, color: plan.status === 'rejected' ? 'var(--danger)' : 'var(--ok)' }}>
            {plan.status === 'rejected' ? '✕ Rejected — discarded, nothing applied.' : '✓ Approved — marked deployed and logged.'}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricBar({ value, threshold, label, unit }: { value: number; threshold: number; label: string; unit: string }) {
  const pct = unit === '%' ? value : Math.min(100, (value / (threshold * 1.15)) * 100)
  const alert = value >= threshold
  const color = alert ? 'var(--danger)' : pct > 70 ? 'var(--warn)' : 'var(--cyan)'
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="jack-mono" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="jack-bar-track"><div className="jack-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

function SettingsModal({ settings, onSave, onClose }: { settings: LLMSettings; onSave: (s: LLMSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<LLMSettings>(settings)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const set = (patch: Partial<LLMSettings>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,14,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--panel-solid)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>⚙ AI Brain — LLM settings</h2>
          <button className="jack-btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Connect any OpenAI-compatible endpoint. Your key is stored only in this browser (localStorage) and is sent directly to the provider you choose. Leave disabled to use the built-in local reasoning engine.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span>Use LLM brain {draft.enabled ? '(on)' : '(off — local engine)'}</span>
        </label>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Provider preset</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PROVIDER_PRESETS.map((p) => (
              <span key={p.label} className="jack-btn ghost" style={{ fontSize: 12.5 }} onClick={() => set({ baseUrl: p.baseUrl, model: p.model })}>{p.label}</span>
            ))}
          </div>
        </div>

        <Field label="Base URL"><input className="jack-input" value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" /></Field>
        <Field label="Model"><input className="jack-input" value={draft.model} onChange={(e) => set({ model: e.target.value })} placeholder="gpt-4o-mini" /></Field>
        <Field label="API key"><input className="jack-input" type="password" value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-… (not needed for local Ollama)" /></Field>
        <Field label={`Temperature: ${draft.temperature.toFixed(1)}`}>
          <input type="range" min={0} max={1} step={0.1} value={draft.temperature} onChange={(e) => set({ temperature: parseFloat(e.target.value) })} style={{ width: '100%' }} />
        </Field>

        {testResult && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 13, border: `1px solid ${testResult.ok ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`, background: testResult.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', color: testResult.ok ? '#bbf7d0' : '#fecaca' }}>
            {testResult.ok ? '✓ ' : '✕ '}{testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="jack-btn" disabled={testing} onClick={async () => { setTesting(true); setTestResult(null); setTestResult(await testConnection(draft)); setTesting(false) }}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button className="jack-btn primary" style={{ marginLeft: 'auto' }} onClick={() => onSave(draft)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('console')
  const [memory, setMemory] = useState<MemoryState>(() =>
    typeof window !== 'undefined' ? loadMemory() : { preferences: {}, facts: [], history: [] },
  )
  const [knowledge, setKnowledge] = useState<KnowledgeState>(() =>
    typeof window !== 'undefined' ? loadKnowledge() : { tools: [], updatedAt: 0 },
  )
  const [llm, setLlm] = useState<LLMSettings>(() =>
    typeof window !== 'undefined' ? loadSettings() : { baseUrl: '', apiKey: '', model: '', temperature: 0.3, enabled: false },
  )
  const [showSettings, setShowSettings] = useState(false)
  const [thinking, setThinking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Voice + automations
  const [lang, setLang] = useState<Lang>('en')
  const [voiceOut, setVoiceOut] = useState(false)
  const [listening, setListening] = useState(false)
  const [automations, setAutomations] = useState<Automation[]>(() =>
    typeof window !== 'undefined' ? loadAutomations() : [],
  )
  const recRef = useRef<Recognizer | null>(null)
  const voiceOutRef = useRef(voiceOut)
  const langRef = useRef(lang)
  voiceOutRef.current = voiceOut
  langRef.current = lang

  // Self-improvement ("Evolve") + Deep Think
  const [skills, setSkills] = useState<Skill[]>(() => (typeof window !== 'undefined' ? loadSkills() : []))
  const [deepThinkOn, setDeepThinkOn] = useState(false)
  const deepRef = useRef(deepThinkOn)
  deepRef.current = deepThinkOn

  function thoughtTrace(text: string): string[] | undefined {
    if (!deepRef.current) return undefined
    const dt = deepThink(text, { toolCount: knowledge.tools.length, factCount: memory.facts.length })
    return [...dt.steps.map((s) => `${s.title} — ${s.detail}`), `➡ ${dt.summary}`]
  }

  function jackSay(text: string) {
    if (voiceOutRef.current) speak(text, langRef.current)
  }

  const llmOn = isConfigured(llm)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(), role: 'jack', ts: Date.now(), module: 'brain',
      text:
        'JACK online. I am your autonomous AI assistant — a **JARVIS for mobile**.\n\n' +
        '🎤 **Talk to me** in **English or Tamil** — tap the mic, and turn on **🔊 JACK voice** so I speak back.\n' +
        '⚡ **Automations:** say **"open youtube"**, **"play netflix"**, **"open video editor"**, or in Tamil **"யூடியூப் திற"** and I\'ll launch it.\n' +
        '🧠 **I learn & remember:** teach me **"when I say music open https://open.spotify.com"** and I keep it across sessions.\n' +
        '🛡 I also reason about **security & infrastructure**. Connect an LLM brain in **⚙ Settings** for free-form reasoning.\n\n' +
        'Open the **⚡ Automations** tab to see everything I can launch, or type **help**.',
    },
  ])
  const [input, setInput] = useState('')
  const [telemetry, setTelemetry] = useState<Telemetry>(() => initialTelemetry(Date.now()))
  const [monitoring, setMonitoring] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!monitoring) return
    console.log('JACK monitor: telemetry loop started')
    const t = setInterval(() => setTelemetry((prev) => tickTelemetry(prev, Date.now())), 1500)
    return () => clearInterval(t)
  }, [monitoring])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, tab, thinking])

  useEffect(() => {
    warmVoices()
  }, [])

  const alertCount = telemetry.alerts.length

  function pushJack(text: string, module: ModuleId = 'brain') {
    setMessages((m) => [...m, { id: uid(), role: 'jack', ts: Date.now(), module, text }])
  }
  function pushSystem(text: string) {
    setMessages((m) => [...m, { id: uid(), role: 'system', ts: Date.now(), module: 'brain', text }])
  }

  // Try to handle a command as an automation (open site/app) or as a request to
  // teach JACK a new automation. Returns true if handled (caller should stop).
  function handleAutomation(text: string): boolean {
    const wantsTeach = /\b(teach|when i say|remember .+ as|add (an )?automation|save .+ as)\b/i.test(text)
    if (wantsTeach) {
      const taught = parseTaughtAutomation(text)
      if (taught) {
        const { list, item } = addAutomation(automations, taught)
        setAutomations(list)
        const reply = `✓ Learned a new automation. Say **${item.triggers.join('** / **')}** and I'll open **${item.label}** (${item.url}).`
        pushJack(reply, 'memory')
        setMemory((mem) => recordHistory(mem, { ts: Date.now(), intent: 'automation.learn', summary: `Learned automation: ${item.label}`, module: 'memory' }))
        jackSay(langRef.current === 'ta' ? `புதிய கட்டளை கற்றுக்கொண்டேன். ${item.label}` : `Learned a new command for ${item.label}`)
        return true
      }
    }
    if (isOpenIntent(text)) {
      const a = matchAutomation(text, automations)
      if (a) {
        runAutomation(a)
        pushJack(`Opening **${a.label}** ▸ ${a.url}`, 'brain')
        setMemory((mem) => recordHistory(mem, { ts: Date.now(), intent: 'automation.run', summary: `Opened ${a.label}`, module: 'memory' }))
        jackSay(langRef.current === 'ta' ? `${a.label} திறக்கிறேன்` : `Opening ${a.label}`)
        return true
      }
    }
    return false
  }

  function persistEffects(opts: { facts?: string[]; prefs?: Record<string, string>; learn?: Array<{ name: string; summary: string; category?: string; usage?: string }> }) {
    let mem = memory
    if (opts.prefs && Object.keys(opts.prefs).length) mem = rememberPreferences(mem, opts.prefs)
    if (opts.facts && opts.facts.length) mem = rememberFacts(mem, opts.facts)
    if (mem !== memory) setMemory(mem)
    if (opts.learn && opts.learn.length) {
      const { state, added } = learnTools(knowledge, opts.learn)
      if (added.length) {
        setKnowledge(state)
        console.log('JACK learned tools:', added.join(', '))
      }
    }
    return mem
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim()
    if (!text || thinking) return
    console.log('JACK ← user:', text)
    const userMsg: ChatMessage = { id: uid(), role: 'user', text, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')

    // Automations first — "open youtube", "play netflix", "open video editor",
    // or teaching a new command. Handled instantly, no LLM needed.
    if (handleAutomation(text)) return

    // Self-authored skills — capabilities JACK added to itself in the Evolve lab.
    const skill = matchSkill(text, skills)
    if (skill) {
      console.log('JACK skill fired →', skill.name)
      setMessages((m) => [...m, { id: uid(), role: 'jack', ts: Date.now(), module: 'brain', text: skill.response, trace: thoughtTrace(text) }])
      jackSay(skill.response)
      return
    }

    // LLM path
    if (llmOn) {
      setThinking(true)
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const history = historyToTurns(messages.map((m) => ({ role: m.role, text: m.text })))
        const res = await reason(text, { settings: llm, memory, knowledge, history, signal: ctrl.signal })
        const mem = persistEffects({ facts: res.rememberFacts, prefs: res.rememberPrefs, learn: res.learnTools })
        if (res.plan) {
          const m2 = recordHistory(mem, { ts: Date.now(), intent: res.plan.intent, summary: res.plan.summary, module: res.plan.module })
          setMemory(m2)
        }
        setMessages((m) => [...m, { id: uid(), role: 'jack', ts: Date.now(), module: res.module, text: res.text, plan: res.plan, artifact: res.artifact, trace: res.trace }])
        jackSay(res.text)
        if (res.module === 'monitor') { setMonitoring(true); setTimeout(() => setTab('dashboard'), 400) }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.log('JACK LLM error:', msg)
        setMessages((m) => [...m, { id: uid(), role: 'system', ts: Date.now(), module: 'brain', text: `⚠ LLM error: ${msg}\n\nFalling back to the local engine for this one. Check ⚙ Settings (base URL / key / model / CORS).` }, localReply(text)])
      } finally {
        setThinking(false)
        abortRef.current = null
      }
      return
    }

    // Local engine path
    const reply = localReply(text)
    const trace = thoughtTrace(text)
    if (trace) reply.trace = trace
    if (reply.module === 'monitor') { setMonitoring(true); setTimeout(() => setTab('dashboard'), 400) }
    setMessages((m) => [...m, reply])
    jackSay(reply.text)
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    if (!sttSupported()) {
      pushSystem('🎤 Voice input is not supported in this browser. Try Chrome, Edge, or Android Chrome.')
      return
    }
    stopSpeaking()
    const rec = createRecognizer(lang, {
      onResult: (t) => { setListening(false); console.log('JACK 🎤 heard:', t); send(t) },
      onEnd: () => setListening(false),
      onError: (e) => { setListening(false); console.log('JACK STT error:', e); if (e === 'not-allowed' || e === 'service-not-allowed') pushSystem('🎤 Microphone permission denied. Allow mic access and try again.') },
    })
    if (!rec) return
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  // Build a ChatMessage from the local rule-based brain + persist its effects.
  function localReply(text: string): ChatMessage {
    const res = think(text, memory, knowledge.tools)
    let mem = memory
    if (res.remember?.preferences) mem = rememberPreferences(mem, res.remember.preferences)
    if (res.remember?.facts) mem = rememberFacts(mem, res.remember.facts)
    if (res.plan) mem = recordHistory(mem, { ts: Date.now(), intent: res.plan.intent, summary: res.plan.summary, module: res.plan.module })
    if (mem !== memory) setMemory(mem)
    return { id: uid(), role: 'jack', text: res.text, ts: Date.now(), module: res.module, plan: res.plan, artifact: res.artifact }
  }

  function decidePlan(msgId: string, approve: boolean) {
    setMessages((msgs) => msgs.map((m) => (m.id === msgId && m.plan ? { ...m, plan: { ...m.plan, status: approve ? ('executed' as const) : ('rejected' as const) } } : m)))
    const target = messages.find((m) => m.id === msgId)
    if (approve && target?.plan) {
      console.log('JACK: plan approved →', target.plan.intent)
      setMemory(recordHistory(memory, { ts: Date.now(), intent: `${target.plan.intent}.deployed`, summary: `Approved & deployed: ${target.plan.summary}`, module: target.plan.module }))
      setMessages((m) => [...m, { id: uid(), role: 'system', ts: Date.now(), module: target.plan!.module, text: '✓ Approved. Configuration marked as deployed and logged. (In a host deployment JACK would apply it via the system agent now.)' }])
    } else {
      console.log('JACK: plan rejected')
    }
  }

  function downloadMemory() {
    const blob = new Blob([exportMemory(memory)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'jack-memory.json'; a.click(); URL.revokeObjectURL(url)
  }

  const suggestions = useMemo(
    () =>
      llmOn
        ? ['Build a firewall for ssh + https', 'Write a hardened Dockerfile for a node app on port 3000', 'Teach yourself about "trivy" and remember it', 'Give me a hardening checklist']
        : ['Build a strong firewall for my server (ssh + https)', 'Generate a hardened Dockerfile for a node app', 'nginx reverse proxy for api.example.com to port 8080', 'Monitor my system'],
    [llmOn],
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{JACK_CSS}</style>
      {showSettings && <SettingsModal settings={llm} onClose={() => setShowSettings(false)} onSave={(s) => { setLlm(s); saveSettings(s); setShowSettings(false); console.log('JACK LLM settings saved. enabled=', s.enabled, 'model=', s.model) }} />}

      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px', borderBottom: '1px solid var(--line)', background: 'rgba(6,9,18,0.7)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="jack-ring"><div className="core" /></div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>J<span style={{ color: 'var(--cyan)' }}>A</span>CK</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Autonomous AI Security Assistant</div>
        </div>
        <nav style={{ display: 'flex', gap: 6, marginLeft: 24, flexWrap: 'wrap' }}>
          {(['console', 'automations', 'evolve', 'dashboard', 'memory', 'knowledge'] as Tab[]).map((t) => (
            <div key={t} className={`jack-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'console' ? '▣ Console' : t === 'automations' ? '⚡ Automations' : t === 'evolve' ? '🧬 Evolve' : t === 'dashboard' ? '📊 Monitor' : t === 'memory' ? '🧠 Memory' : '📚 Knowledge'}
              {t === 'dashboard' && monitoring && alertCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>({alertCount})</span>}
              {t === 'automations' && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({BUILTIN.length + automations.length})</span>}
              {t === 'evolve' && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({skills.length})</span>}
              {t === 'knowledge' && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({knowledge.tools.length})</span>}
            </div>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="jack-dot" style={{ background: llmOn ? 'var(--cyan)' : 'var(--ok)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{llmOn ? `LLM · ${llm.model}` : 'local brain'}</span>
          <button className="jack-btn ghost" onClick={() => setShowSettings(true)}>⚙ Settings</button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 920, width: '100%', margin: '0 auto', padding: '20px 18px', display: 'flex', flexDirection: 'column' }}>
        {tab === 'console' && (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {messages.map((m) => (
                <div key={m.id} className="jack-msg" style={{ marginBottom: 18, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '86%' }}>
                    {m.role !== 'user' && (
                      <div style={{ fontSize: 11, color: m.module ? MODULE_META[m.module].color : 'var(--cyan)', marginBottom: 4, letterSpacing: 1 }}>
                        {m.role === 'system' ? 'SYSTEM' : `JACK · ${m.module ? MODULE_META[m.module].label : 'AI Brain'}`}
                      </div>
                    )}
                    <div style={{ padding: '12px 15px', borderRadius: 14, fontSize: 14.5, lineHeight: 1.6, border: '1px solid var(--line)', background: m.role === 'user' ? 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(14,165,233,0.10))' : m.role === 'system' ? 'rgba(52,211,153,0.07)' : 'var(--panel)', borderColor: m.role === 'user' ? 'rgba(56,189,248,0.35)' : 'var(--line)' }}>
                      <Rich text={m.text} />
                      {m.trace && m.trace.length > 0 && <Trace trace={m.trace} />}
                      {m.plan && <PlanCard plan={m.plan} onApprove={() => decidePlan(m.id, true)} onReject={() => decidePlan(m.id, false)} />}
                    </div>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="jack-msg" style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 4, letterSpacing: 1 }}>JACK · AI Brain</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel)' }}>
                    <span className="jack-dot" /> <span style={{ color: 'var(--muted)', fontSize: 14 }}>reasoning…</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {suggestions.map((s) => (
                <span key={s} onClick={() => send(s)} className="jack-btn ghost" style={{ fontSize: 12.5, cursor: 'pointer', color: 'var(--muted)' }}>{s}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Voice:</span>
              {LANGS.map((l) => (
                <span key={l.id} onClick={() => setLang(l.id)} className={`jack-btn ghost ${lang === l.id ? '' : ''}`} style={{ fontSize: 12.5, cursor: 'pointer', borderColor: lang === l.id ? 'var(--cyan)' : 'var(--line)', color: lang === l.id ? 'var(--cyan)' : 'var(--muted)' }}>{l.label}</span>
              ))}
              <span
                onClick={() => { const next = !voiceOut; setVoiceOut(next); if (!next) stopSpeaking() }}
                className="jack-btn ghost"
                style={{ fontSize: 12.5, cursor: 'pointer', marginLeft: 6, color: voiceOut ? 'var(--cyan)' : 'var(--muted)', borderColor: voiceOut ? 'var(--cyan)' : 'var(--line)' }}
                title="JACK speaks replies aloud"
              >
                {voiceOut ? '🔊 JACK voice: on' : '🔈 JACK voice: off'}
              </span>
              {!ttsSupported() && <span style={{ fontSize: 11, color: 'var(--warn)' }}>· speech not supported here</span>}
              <span
                onClick={() => setDeepThinkOn((v) => !v)}
                className="jack-btn ghost"
                style={{ fontSize: 12.5, cursor: 'pointer', marginLeft: 'auto', color: deepThinkOn ? 'var(--cyan)' : 'var(--muted)', borderColor: deepThinkOn ? 'var(--cyan)' : 'var(--line)' }}
                title="Show JACK's multi-step reasoning before each answer"
              >
                {deepThinkOn ? '🧠 Deep Think: on' : '🧠 Deep Think: off'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className={`jack-btn ${listening ? 'danger' : ''}`}
                onClick={toggleMic}
                title="Speak a command (English / Tamil)"
                style={{ minWidth: 52, fontSize: 18, animation: listening ? 'jpulse 1.2s infinite' : undefined }}
              >
                {listening ? '⏹' : '🎤'}
              </button>
              <input className="jack-input" value={input} placeholder={listening ? 'Listening…' : llmOn ? 'Ask JACK, or "open youtube"…' : 'Ask JACK or say "open youtube", "play netflix"…'} disabled={thinking} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button className="jack-btn primary" onClick={() => send()} disabled={thinking}>{thinking ? '…' : 'Send ▸'}</button>
            </div>
          </>
        )}

        {tab === 'automations' && (
          <AutomationsPanel
            customs={automations}
            onRun={(a) => { runAutomation(a); jackSay(langRef.current === 'ta' ? `${a.label} திறக்கிறேன்` : `Opening ${a.label}`) }}
            onAdd={(a) => { const { list } = addAutomation(automations, a); setAutomations(list); console.log('JACK automation added:', a.label) }}
            onForget={(id) => setAutomations(removeAutomation(automations, id))}
          />
        )}

        {tab === 'evolve' && (
          <EvolvePanel
            skills={skills}
            ctx={{
              userName: memory.preferences.userName,
              factCount: memory.facts.length,
              historyTopModule: topModule(memory.history),
              toolCount: knowledge.tools.length,
              automationCount: automations.length,
              skillCount: skills.length,
            }}
            onInstallSkill={(s) => { const list = addSkill(skills, s); setSkills(list); setMemory((mem) => recordHistory(mem, { ts: Date.now(), intent: 'evolve.skill', summary: `Authored new skill: ${s.name}`, module: 'memory' })) }}
            onForgetSkill={(id) => setSkills(removeSkill(skills, id))}
            onAcceptCode={(imp) => { setMemory((mem) => recordHistory(mem, { ts: Date.now(), intent: 'evolve.code', summary: `Accepted self-improvement: ${imp.title}`, module: 'memory' })); console.log('JACK self-improvement accepted →', imp.title) }}
          />
        )}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>System Monitor</h2>
              <button className={`jack-btn ${monitoring ? 'danger' : 'primary'}`} style={{ marginLeft: 'auto' }} onClick={() => { setMonitoring((v) => !v); console.log('JACK monitor toggled →', !monitoring) }}>{monitoring ? '■ Stop monitoring' : '▶ Start monitoring'}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
              {telemetry.metrics.map((mtr) => (
                <div key={mtr.key} style={{ padding: 18, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel)' }}>
                  <MetricBar value={mtr.value} threshold={mtr.threshold} label={mtr.label} unit={mtr.unit} />
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>threshold {mtr.threshold}{mtr.unit}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22 }}>
              <h3 style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>Active alerts</h3>
              {!monitoring ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>Monitoring is stopped. Start it to receive live alerts.</p>
                : alertCount === 0 ? <p style={{ color: 'var(--ok)', fontSize: 14 }}>✓ All systems nominal — no thresholds exceeded.</p>
                : telemetry.alerts.map((a, i) => <div key={i} style={{ padding: '10px 14px', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#fecaca', fontSize: 13.5 }}>{a}</div>)}
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Memory</h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="jack-btn" onClick={downloadMemory}>⤓ Export</button>
                <button className="jack-btn danger" onClick={() => { setMemory(clearMemory()); console.log('JACK memory wiped') }}>Wipe</button>
              </div>
            </div>
            <Section title="Preferences">
              {Object.keys(memory.preferences).length === 0 ? <Empty>No preferences yet. Try "my name is …".</Empty>
                : Object.entries(memory.preferences).map(([k, v]) => <Row key={k}><span style={{ color: 'var(--cyan)' }}>{k}</span><span>{v}</span></Row>)}
            </Section>
            <Section title={`Facts (${memory.facts.length})`}>
              {memory.facts.length === 0 ? <Empty>Nothing learned yet.</Empty> : memory.facts.map((f, i) => <div key={i} style={{ fontSize: 14, padding: '4px 0' }}>• {f}</div>)}
            </Section>
            <Section title={`Task history (${memory.history.length})`}>
              {memory.history.length === 0 ? <Empty>No actions recorded.</Empty>
                : [...memory.history].reverse().map((h, i) => <Row key={i}><span style={{ color: MODULE_META[h.module].color }}>{h.intent}</span><span style={{ color: 'var(--muted)', fontSize: 13 }}>{h.summary}</span></Row>)}
            </Section>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>🔒 Stored only in your browser (localStorage).</p>
          </div>
        )}

        {tab === 'knowledge' && <KnowledgePanel knowledge={knowledge} onTeach={(t) => { const { state, added } = learnTools(knowledge, [t], 'taught'); if (added.length) { setKnowledge(state); console.log('JACK taught:', added.join(', ')) } }} onForget={(name) => setKnowledge(forgetTool(knowledge, name))} />}
      </main>

      <footer style={{ textAlign: 'center', padding: '12px', fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
        JACK · defensive, human-supervised AI · {llmOn ? `LLM brain (${llm.model})` : 'local reasoning engine'} · {knowledge.tools.length} tools known · {capabilities().length > 0 ? 'all actions require approval' : ''}
      </footer>
    </div>
  )
}

function KnowledgePanel({ knowledge, onTeach, onForget }: { knowledge: KnowledgeState; onTeach: (t: { name: string; category: string; summary: string; usage?: string }) => void; onForget: (name: string) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [summary, setSummary] = useState('')
  const [usage, setUsage] = useState('')
  const cats = Array.from(new Set(knowledge.tools.map((t) => t.category)))
  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Knowledge Base</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        Tools JACK knows. The LLM brain learns new ones automatically (via the <span className="jack-mono">learn_tool</span> tool) and you can teach it below. This knowledge is injected into the brain's context so it improves over time.
      </p>

      <Section title="Teach JACK a tool">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input className="jack-input" placeholder="name (e.g. trivy)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="jack-input" placeholder="category (e.g. scanner)" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <input className="jack-input" placeholder="summary — what it does" value={summary} onChange={(e) => setSummary(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
        <input className="jack-input" placeholder="usage example (optional)" value={usage} onChange={(e) => setUsage(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
        <button className="jack-btn primary" disabled={!name.trim() || !summary.trim()} onClick={() => { onTeach({ name, category: category || 'general', summary, usage: usage || undefined }); setName(''); setCategory(''); setSummary(''); setUsage('') }}>+ Teach</button>
      </Section>

      {cats.map((cat) => (
        <Section key={cat} title={cat}>
          {knowledge.tools.filter((t) => t.category === cat).map((t) => (
            <div key={t.name} style={{ padding: '8px 0', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px' }}>{t.source}</span>
                <button className="jack-btn ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }} onClick={() => onForget(t.name)}>forget</button>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 2 }}>{t.summary}</div>
              {t.usage && <div className="jack-mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>$ {t.usage}</div>}
            </div>
          ))}
        </Section>
      ))}
    </div>
  )
}

function AutomationsPanel({
  customs,
  onRun,
  onAdd,
  onForget,
}: {
  customs: Automation[]
  onRun: (a: Automation) => void
  onAdd: (a: Automation) => void
  onForget: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [triggers, setTriggers] = useState('')

  const all = [...customs, ...BUILTIN]
  const cats = Array.from(new Set(all.map((a) => a.category)))

  function add() {
    let u = url.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    const name = (label.trim() || (() => { try { return new URL(u).hostname.replace(/^www\./, '').split('.')[0] ?? 'site' } catch { return 'site' } })())
    const trigs = triggers.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    onAdd({
      id: `learned_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${u.length}`,
      label: name,
      url: u,
      icon: '⭐',
      category: 'custom',
      triggers: trigs.length ? trigs : [name.toLowerCase()],
      source: 'learned',
    })
    setLabel(''); setUrl(''); setTriggers('')
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>⚡ Automations</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        Say or type <span className="jack-mono">open youtube</span>, <span className="jack-mono">play netflix</span>, <span className="jack-mono">open video editor</span> — in English or Tamil (<span className="jack-mono">யூடியூப் திற</span>). Tap any card to launch it. Teach JACK your own below — it remembers them across sessions.
      </p>

      <Section title="Teach JACK a new automation">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input className="jack-input" placeholder="name (e.g. My Blog)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="jack-input" placeholder="url (e.g. example.com)" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <input className="jack-input" placeholder="trigger words, comma separated (e.g. my blog, blog)" value={triggers} onChange={(e) => setTriggers(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
        <button className="jack-btn primary" disabled={!url.trim()} onClick={add}>+ Teach automation</button>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>Tip: in chat you can also say <span className="jack-mono">when I say music open https://open.spotify.com</span>.</p>
      </Section>

      {customs.length > 0 && (
        <Section title={`Your taught automations (${customs.length})`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 10 }}>
            {customs.map((a) => (
              <AutoCard key={a.id} a={a} onRun={onRun} onForget={() => onForget(a.id)} />
            ))}
          </div>
        </Section>
      )}

      {cats.filter((c) => c !== 'custom').map((cat) => (
        <Section key={cat} title={cat}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 10 }}>
            {BUILTIN.filter((a) => a.category === cat).map((a) => (
              <AutoCard key={a.id} a={a} onRun={onRun} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

function topModule(history: { module: ModuleId }[]): string | undefined {
  if (!history.length) return undefined
  const counts = new Map<string, number>()
  for (const h of history) counts.set(h.module, (counts.get(h.module) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function EvolvePanel({
  skills,
  ctx,
  onInstallSkill,
  onForgetSkill,
  onAcceptCode,
}: {
  skills: Skill[]
  ctx: EvolveContext
  onInstallSkill: (s: Omit<Skill, 'createdAt'>) => void
  onForgetSkill: (id: string) => void
  onAcceptCode: (imp: Improvement) => void
}) {
  const proposals = useMemo(() => proposeImprovements(ctx), [ctx])
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [name, setName] = useState('')
  const [triggers, setTriggers] = useState('')
  const [response, setResponse] = useState('')

  function decide(imp: Improvement, ok: boolean) {
    setDecided((d) => ({ ...d, [imp.id]: ok ? 'approved' : 'rejected' }))
    if (!ok) return
    if (imp.kind === 'skill' && imp.skill) onInstallSkill(imp.skill)
    else onAcceptCode(imp)
  }

  function authorManual() {
    const trigs = triggers.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (!name.trim() || !trigs.length || !response.trim()) return
    onInstallSkill({
      id: `skill_manual_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: name.trim(),
      description: 'Authored by you',
      triggers: trigs,
      response: response.trim(),
      source: 'taught',
    })
    setName(''); setTriggers(''); setResponse('')
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>🧬 Self-Improvement Lab</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        This is how JACK gets better over time — safely. JACK <strong style={{ color: 'var(--cyan)' }}>authors new skills</strong> (capabilities it starts using the moment you approve them) and <strong style={{ color: 'var(--cyan)' }}>drafts code patches to its own source</strong> for you to ship. Every change is human-approved — JACK writes, you decide.
      </p>
      <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'rgba(56,189,248,0.05)', fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>
        ℹ️ Honest by design: a web app can't hot-patch its own running bundle or become a superintelligence. JACK is a powerful, <em>self-extending</em> assistant — it adds real new behaviour to itself and proposes real upgrades, all under your control. Turn on <strong>🧠 Deep Think</strong> on the Console to watch its reasoning.
      </div>

      <Section title="Author a skill yourself">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input className="jack-input" placeholder="skill name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="jack-input" placeholder="triggers (comma separated)" value={triggers} onChange={(e) => setTriggers(e.target.value)} />
        </div>
        <input className="jack-input" placeholder="what JACK should reply" value={response} onChange={(e) => setResponse(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
        <button className="jack-btn primary" disabled={!name.trim() || !triggers.trim() || !response.trim()} onClick={authorManual}>+ Install skill</button>
      </Section>

      {skills.length > 0 && (
        <Section title={`Installed skills (${skills.length})`}>
          {skills.map((s) => (
            <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px' }}>{s.source}</span>
                <button className="jack-btn ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }} onClick={() => onForgetSkill(s.id)}>forget</button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>triggers: {s.triggers.join(', ')}</div>
              <div style={{ fontSize: 13.5, marginTop: 2 }}>“{s.response}”</div>
            </div>
          ))}
        </Section>
      )}

      <Section title="JACK's improvement proposals">
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 12 }}>JACK reflected on its memory, tools and usage and proposes these upgrades to itself:</p>
        {proposals.map((imp) => {
          const state = decided[imp.id]
          return (
            <div key={imp.id} style={{ marginBottom: 12, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--line)', background: imp.kind === 'code' ? 'rgba(167,139,250,0.06)' : 'rgba(52,211,153,0.06)' }}>
                <span style={{ fontSize: 12, color: imp.kind === 'code' ? 'var(--infra, #a78bfa)' : 'var(--ok)', fontWeight: 600 }}>{imp.kind === 'code' ? '⟨code⟩' : '◆ skill'}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{imp.title}</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{imp.rationale}</div>
                {imp.file && <div className="jack-mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>📄 {imp.file}</div>}
                {imp.patch && <pre className="jack-code jack-mono" style={{ marginTop: 8 }}><code>{imp.patch}</code></pre>}
                {!state ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="jack-btn danger" onClick={() => decide(imp, false)}>Dismiss</button>
                    <button className="jack-btn primary" style={{ marginLeft: 'auto' }} onClick={() => decide(imp, true)}>{imp.kind === 'skill' ? 'Install skill' : 'Accept patch'}</button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 13, color: state === 'approved' ? 'var(--ok)' : 'var(--danger)' }}>
                    {state === 'approved' ? (imp.kind === 'skill' ? '✓ Installed — JACK is using this skill now.' : '✓ Accepted & logged. Ask me to "implement it" and I\'ll prepare the code change for review.') : '✕ Dismissed.'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function AutoCard({ a, onRun, onForget }: { a: Automation; onRun: (a: Automation) => void; onForget?: () => void }) {
  return (
    <div
      onClick={() => onRun(a)}
      style={{ cursor: 'pointer', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', transition: '.15s', position: 'relative' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cyan)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)' }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>“{a.triggers[0]}”</div>
      {onForget && (
        <span onClick={(e) => { e.stopPropagation(); onForget() }} className="jack-btn ghost" style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, padding: '2px 6px' }}>✕</span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, padding: 16, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, letterSpacing: 1 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  )
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderBottom: '1px solid rgba(56,189,248,0.06)', fontSize: 14 }}>{children}</div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>{children}</div>
}
