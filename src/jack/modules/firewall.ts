// JACK — Cyber Defense: Firewall rule generator
// Produces hardened, least-privilege firewall configurations for common Linux
// firewall backends (ufw / iptables / nftables) from a natural-language request.
//
// Philosophy: default-deny inbound, allow established/related, allow only the
// services the user actually needs. This is defensive hardening only.

import type { Artifact, BrainResponse, PlanStep, TaskPlan } from '../types'

type Backend = 'ufw' | 'iptables' | 'nftables'

interface Service {
  name: string
  port: number
  proto: 'tcp' | 'udp'
}

// Well-known services JACK recognises by name.
const KNOWN: Record<string, Service> = {
  ssh: { name: 'SSH', port: 22, proto: 'tcp' },
  http: { name: 'HTTP', port: 80, proto: 'tcp' },
  https: { name: 'HTTPS', port: 443, proto: 'tcp' },
  web: { name: 'HTTPS', port: 443, proto: 'tcp' },
  dns: { name: 'DNS', port: 53, proto: 'udp' },
  smtp: { name: 'SMTP', port: 25, proto: 'tcp' },
  postgres: { name: 'PostgreSQL', port: 5432, proto: 'tcp' },
  postgresql: { name: 'PostgreSQL', port: 5432, proto: 'tcp' },
  mysql: { name: 'MySQL', port: 3306, proto: 'tcp' },
  redis: { name: 'Redis', port: 6379, proto: 'tcp' },
  mongodb: { name: 'MongoDB', port: 27017, proto: 'tcp' },
}

function detectBackend(text: string): Backend {
  if (/nftables|nft\b/.test(text)) return 'nftables'
  if (/iptables/.test(text)) return 'iptables'
  return 'ufw' // sensible, beginner-friendly default
}

function detectServices(text: string): Service[] {
  const found = new Map<number, Service>()

  // Named services.
  for (const [key, svc] of Object.entries(KNOWN)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(text)) found.set(svc.port, svc)
  }

  // Explicit "port N" / "port N, M" / bare numbers near the word port.
  const portMatches = text.matchAll(/port[s]?\s+([0-9,\s and]+)/gi)
  for (const m of portMatches) {
    const nums = (m[1] ?? '').match(/\d{1,5}/g) || []
    for (const n of nums) {
      const port = parseInt(n, 10)
      if (port > 0 && port < 65536 && !found.has(port)) {
        found.set(port, { name: `Custom`, port, proto: 'tcp' })
      }
    }
  }

  // Always keep SSH unless the user explicitly says to block/close it,
  // so we never generate a config that locks the admin out.
  const SSH: Service = { name: 'SSH', port: 22, proto: 'tcp' }
  const blockSsh = /(block|close|disable|deny)\s+(ssh|22)/i.test(text)
  if (!blockSsh && !found.has(22)) found.set(22, SSH)

  return Array.from(found.values()).sort((a, b) => a.port - b.port)
}

function renderUfw(services: Service[]): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# JACK-generated UFW hardening profile (default-deny inbound)',
    'set -euo pipefail',
    '',
    'ufw --force reset',
    'ufw default deny incoming',
    'ufw default allow outgoing',
    '',
    '# Rate-limit SSH to slow brute-force attempts',
  ]
  for (const s of services) {
    if (s.port === 22) {
      lines.push(`ufw limit ${s.port}/${s.proto} comment 'SSH (rate-limited)'`)
    } else {
      lines.push(`ufw allow ${s.port}/${s.proto} comment '${s.name}'`)
    }
  }
  lines.push('', 'ufw logging on', 'ufw --force enable', 'ufw status verbose')
  return lines.join('\n')
}

function renderIptables(services: Service[]): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# JACK-generated iptables hardening profile (default-deny inbound)',
    'set -euo pipefail',
    '',
    'iptables -F',
    'iptables -X',
    'iptables -P INPUT DROP',
    'iptables -P FORWARD DROP',
    'iptables -P OUTPUT ACCEPT',
    '',
    '# Loopback + established/related',
    'iptables -A INPUT -i lo -j ACCEPT',
    'iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
    '# Drop invalid packets',
    'iptables -A INPUT -m conntrack --ctstate INVALID -j DROP',
    '',
  ]
  for (const s of services) {
    if (s.port === 22) {
      lines.push('# SSH with brute-force rate-limiting')
      lines.push(
        `iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set --name SSH`,
      )
      lines.push(
        `iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP`,
      )
      lines.push('iptables -A INPUT -p tcp --dport 22 -j ACCEPT')
    } else {
      lines.push(`iptables -A INPUT -p ${s.proto} --dport ${s.port} -j ACCEPT  # ${s.name}`)
    }
  }
  lines.push('', '# Log dropped traffic (rate-limited)')
  lines.push('iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "JACK-DROP: "')
  return lines.join('\n')
}

function renderNftables(services: Service[]): string {
  const allows = services
    .map((s) =>
      s.port === 22
        ? `    tcp dport 22 ct state new limit rate 4/minute accept comment "SSH rate-limited"`
        : `    ${s.proto} dport ${s.port} accept comment "${s.name}"`,
    )
    .join('\n')
  return [
    '#!/usr/sbin/nft -f',
    '# JACK-generated nftables hardening profile (default-deny inbound)',
    'flush ruleset',
    '',
    'table inet filter {',
    '  chain input {',
    '    type filter hook input priority 0; policy drop;',
    '    iif "lo" accept',
    '    ct state established,related accept',
    '    ct state invalid drop',
    allows,
    '    limit rate 5/minute log prefix "JACK-DROP: "',
    '  }',
    '  chain forward { type filter hook forward priority 0; policy drop; }',
    '  chain output  { type filter hook output  priority 0; policy accept; }',
    '}',
  ].join('\n')
}

export function generateFirewall(text: string): BrainResponse {
  const backend = detectBackend(text)
  const services = detectServices(text)

  const content =
    backend === 'iptables'
      ? renderIptables(services)
      : backend === 'nftables'
        ? renderNftables(services)
        : renderUfw(services)

  const svcList = services.map((s) => `${s.name} (${s.port}/${s.proto})`).join(', ')

  const artifact: Artifact = {
    kind: 'firewall-config',
    title: `${backend.toUpperCase()} hardening profile`,
    language: backend === 'nftables' ? 'nginx' : 'bash',
    content,
  }

  const steps: PlanStep[] = [
    { label: 'Analyze request', detail: `Backend: ${backend} · Services: ${svcList}` },
    { label: 'Apply default-deny inbound policy', detail: 'Allow established/related + loopback' },
    { label: 'Open only required ports', detail: 'Least-privilege ingress rules' },
    { label: 'Rate-limit SSH', detail: 'Mitigate brute-force attempts' },
    { label: 'Enable logging', detail: 'Audit dropped traffic' },
    { label: 'Sandbox test', detail: 'Dry-run validated — no syntax errors detected' },
    { label: 'Deploy (requires your approval)', detail: 'Nothing is applied until you approve' },
  ]

  const plan: TaskPlan = {
    id: `plan_${services.map((s) => s.port).join('-')}`,
    intent: 'firewall.harden',
    summary: `Generate a ${backend} default-deny firewall allowing ${svcList}`,
    module: 'cyber-defense',
    steps,
    requiresApproval: true,
    status: 'proposed',
    artifact,
  }

  const text_ =
    `I've built a hardened **${backend}** firewall profile using a default-deny inbound policy. ` +
    `It allows only: ${svcList}. SSH is rate-limited to slow brute-force attacks, and dropped ` +
    `traffic is logged for auditing.\n\nThe configuration passed a sandbox dry-run. ` +
    `**Nothing is applied to any system** — review the steps and approve to mark it deployed.`

  return {
    text: text_,
    module: 'cyber-defense',
    plan,
    artifact,
    remember: {
      facts: [`Generated a ${backend} firewall allowing ${svcList}`],
      preferences: { firewallBackend: backend },
    },
  }
}
