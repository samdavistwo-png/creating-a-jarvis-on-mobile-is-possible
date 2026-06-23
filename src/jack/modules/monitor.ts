// JACK — Automation Engine: System monitoring
// Provides a simulated live telemetry feed with configurable alert thresholds.
// In a host deployment these readings would come from /proc, psutil, or a
// metrics agent; here they are simulated so the dashboard is fully demoable
// in the browser with no backend.

export interface Metric {
  key: 'cpu' | 'memory' | 'disk' | 'network'
  label: string
  unit: string
  value: number
  threshold: number
  /** higher value = worse (true) e.g. cpu; or remaining headroom semantics */
}

export interface Telemetry {
  ts: number
  metrics: Metric[]
  alerts: string[]
}

// Deterministic-ish wandering using a seeded walk so the dashboard feels alive
// without Math.random (kept simple + bounded).
function wander(prev: number, min: number, max: number, step: number, seed: number): number {
  const drift = Math.sin(seed / 7) * step + Math.cos(seed / 3) * (step / 2)
  let next = prev + drift
  if (next < min) next = min + Math.abs(drift)
  if (next > max) next = max - Math.abs(drift)
  return Math.round(next * 10) / 10
}

const DEFAULT_THRESHOLDS = { cpu: 85, memory: 90, disk: 90, network: 800 }

export function initialTelemetry(now: number): Telemetry {
  return {
    ts: now,
    metrics: [
      { key: 'cpu', label: 'CPU Load', unit: '%', value: 24, threshold: DEFAULT_THRESHOLDS.cpu },
      { key: 'memory', label: 'Memory', unit: '%', value: 41, threshold: DEFAULT_THRESHOLDS.memory },
      { key: 'disk', label: 'Disk Usage', unit: '%', value: 63, threshold: DEFAULT_THRESHOLDS.disk },
      { key: 'network', label: 'Network', unit: 'Mb/s', value: 120, threshold: DEFAULT_THRESHOLDS.network },
    ],
    alerts: [],
  }
}

export function tickTelemetry(prev: Telemetry, now: number): Telemetry {
  const seed = Math.floor(now / 1000)
  const ranges: Record<Metric['key'], [number, number, number]> = {
    cpu: [5, 98, 9],
    memory: [30, 96, 4],
    disk: [60, 95, 0.4],
    network: [20, 950, 80],
  }
  const metrics = prev.metrics.map((m, i) => {
    const [min, max, step] = ranges[m.key]
    return { ...m, value: wander(m.value, min, max, step, seed + i * 13) }
  })

  const alerts: string[] = []
  for (const m of metrics) {
    if (m.value >= m.threshold) {
      alerts.push(`⚠ ${m.label} at ${m.value}${m.unit} — exceeds ${m.threshold}${m.unit} threshold`)
    }
  }
  // Disk-space style "below 10% free" check handled as usage>=90 above.

  return { ts: now, metrics, alerts }
}

export function describeMonitoring(): string {
  return (
    'Live monitoring is active. I am watching **CPU, memory, disk, and network** with alert ' +
    'thresholds (CPU 85%, memory 90%, disk 90%, network 800 Mb/s). When any metric crosses its ' +
    'threshold I raise an alert in the dashboard. In a host deployment these readings come from ' +
    'the system metrics agent; in this console they are simulated so you can see the behaviour live.'
  )
}
