// JACK — Infrastructure Automation
// Generates hardened, production-sensible infrastructure artifacts from a
// natural-language request: Dockerfile, docker-compose, nginx reverse proxy
// (TLS + security headers), systemd unit (sandboxed), and a Terraform skeleton.
//
// Like the firewall module, everything is produced as an APPROVABLE plan with
// the artifact attached — JACK never applies anything without sign-off. Secure
// defaults are baked in (non-root, least-privilege, healthchecks, headers).

import type { Artifact, BrainResponse, PlanStep, TaskPlan } from '../types'

type InfraKind = 'dockerfile' | 'compose' | 'nginx' | 'systemd' | 'terraform'

interface Parsed {
  kind: InfraKind
  runtime: string // node | python | go | static | generic
  port: number
  domain?: string
  service: string
}

const RUNTIMES: Record<string, { base: string; install: string; run: string; port: number }> = {
  node: { base: 'node:22-alpine', install: 'npm ci --omit=dev', run: 'node server.js', port: 3000 },
  python: { base: 'python:3.12-slim', install: 'pip install --no-cache-dir -r requirements.txt', run: 'python -m app', port: 8000 },
  go: { base: 'golang:1.23-alpine', install: 'go mod download', run: './app', port: 8080 },
  static: { base: 'nginx:alpine', install: '# static assets', run: 'nginx -g "daemon off;"', port: 80 },
  generic: { base: 'debian:stable-slim', install: '# install deps', run: './start.sh', port: 8080 },
}

function detect(text: string): Parsed {
  const t = text.toLowerCase()
  const kind: InfraKind =
    /compose/.test(t) ? 'compose'
    : /nginx|reverse.?proxy|proxy/.test(t) ? 'nginx'
    : /systemd|service unit|daemon/.test(t) ? 'systemd'
    : /terraform|iac|infrastructure as code/.test(t) ? 'terraform'
    : 'dockerfile'

  const runtime =
    /\bnode|express|typescript|javascript|bun\b/.test(t) ? 'node'
    : /\bpython|flask|django|fastapi\b/.test(t) ? 'python'
    : /\bgo\b|golang/.test(t) ? 'go'
    : /static|html|spa/.test(t) ? 'static'
    : 'node'

  const portMatch = t.match(/port\s+(\d{2,5})/)
  const port = portMatch ? parseInt(portMatch[1]!, 10) : RUNTIMES[runtime]!.port
  const domainMatch = t.match(/([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/)
  const domain = domainMatch ? domainMatch[1] : undefined
  const svcMatch = t.match(/(?:for|called|named)\s+([a-z0-9_-]{2,30})/)
  const service = svcMatch ? svcMatch[1]! : 'app'

  return { kind, runtime, port, domain, service }
}

function dockerfile(p: Parsed): string {
  const r = RUNTIMES[p.runtime]!
  return [
    `# JACK-generated hardened Dockerfile (${p.runtime})`,
    `FROM ${r.base}`,
    '',
    '# Run as a non-root user',
    'RUN addgroup -S app 2>/dev/null || groupadd -r app; \\',
    '    adduser -S -G app app 2>/dev/null || useradd -r -g app app',
    '',
    'WORKDIR /app',
    'COPY --chown=app:app . .',
    `RUN ${r.install}`,
    '',
    'USER app',
    `EXPOSE ${p.port}`,
    `HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost:${p.port}/health || exit 1`,
    `CMD ["sh","-c","${r.run}"]`,
  ].join('\n')
}

function compose(p: Parsed): string {
  return [
    '# JACK-generated docker-compose (hardened defaults)',
    'services:',
    `  ${p.service}:`,
    '    build: .',
    '    restart: unless-stopped',
    '    read_only: true',
    '    cap_drop: ["ALL"]',
    '    security_opt: ["no-new-privileges:true"]',
    `    ports: ["127.0.0.1:${p.port}:${p.port}"]   # bind localhost; front with a proxy`,
    '    tmpfs: ["/tmp"]',
    '    environment:',
    '      - NODE_ENV=production',
    '    healthcheck:',
    `      test: ["CMD","wget","-qO-","http://localhost:${p.port}/health"]`,
    '      interval: 30s',
    '      timeout: 3s',
    '      retries: 3',
    '    deploy:',
    '      resources:',
    '        limits: { cpus: "1.0", memory: 512M }',
  ].join('\n')
}

function nginx(p: Parsed): string {
  const host = p.domain ?? 'example.com'
  return [
    `# JACK-generated nginx reverse proxy for ${host} (TLS + security headers)`,
    'server {',
    '    listen 80;',
    `    server_name ${host};`,
    '    return 301 https://$host$request_uri;   # force HTTPS',
    '}',
    '',
    'server {',
    '    listen 443 ssl http2;',
    `    server_name ${host};`,
    '',
    `    ssl_certificate     /etc/letsencrypt/live/${host}/fullchain.pem;`,
    `    ssl_certificate_key /etc/letsencrypt/live/${host}/privkey.pem;`,
    '    ssl_protocols TLSv1.2 TLSv1.3;',
    '    ssl_prefer_server_ciphers on;',
    '',
    '    # Security headers',
    '    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;',
    '    add_header X-Content-Type-Options nosniff always;',
    '    add_header X-Frame-Options DENY always;',
    '    add_header Referrer-Policy strict-origin-when-cross-origin always;',
    "    add_header Content-Security-Policy \"default-src 'self'\" always;",
    '',
    '    location / {',
    `        proxy_pass http://127.0.0.1:${p.port};`,
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '    }',
    '}',
  ].join('\n')
}

function systemd(p: Parsed): string {
  return [
    `# JACK-generated hardened systemd unit: /etc/systemd/system/${p.service}.service`,
    '[Unit]',
    `Description=${p.service} service`,
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=/usr/bin/env ${RUNTIMES[p.runtime]!.run}`,
    `WorkingDirectory=/opt/${p.service}`,
    'User=app',
    'Group=app',
    'Restart=on-failure',
    'RestartSec=5',
    '',
    '# Sandboxing / hardening',
    'NoNewPrivileges=true',
    'ProtectSystem=strict',
    'ProtectHome=true',
    'PrivateTmp=true',
    'PrivateDevices=true',
    'ProtectKernelTunables=true',
    'ProtectControlGroups=true',
    'RestrictAddressFamilies=AF_INET AF_INET6',
    `ReadWritePaths=/opt/${p.service}/data`,
    '',
    '[Install]',
    'WantedBy=multi-user.target',
  ].join('\n')
}

function terraform(p: Parsed): string {
  return [
    '# JACK-generated Terraform skeleton (provider-agnostic example)',
    'terraform {',
    '  required_version = ">= 1.6"',
    '}',
    '',
    `variable "service_name" { default = "${p.service}" }`,
    `variable "container_port" { default = ${p.port} }`,
    '',
    '# Example: a Docker container resource (swap for your cloud provider).',
    'resource "docker_image" "app" {',
    '  name = "${var.service_name}:latest"',
    '}',
    '',
    'resource "docker_container" "app" {',
    '  name  = var.service_name',
    '  image = docker_image.app.image_id',
    '  restart = "unless-stopped"',
    '  ports {',
    '    internal = var.container_port',
    '    external = var.container_port',
    '    ip       = "127.0.0.1"',
    '  }',
    '  # Least-privilege defaults',
    '  capabilities { drop = ["ALL"] }',
    '  read_only = true',
    '}',
  ].join('\n')
}

const RENDER: Record<InfraKind, (p: Parsed) => string> = {
  dockerfile, compose, nginx, systemd, terraform,
}

const LABELS: Record<InfraKind, { title: string; lang: string }> = {
  dockerfile: { title: 'Dockerfile', lang: 'docker' },
  compose: { title: 'docker-compose.yml', lang: 'yaml' },
  nginx: { title: 'nginx reverse-proxy config', lang: 'nginx' },
  systemd: { title: 'systemd unit', lang: 'ini' },
  terraform: { title: 'Terraform configuration', lang: 'hcl' },
}

export function generateInfra(text: string): BrainResponse {
  const p = detect(text)
  const content = RENDER[p.kind](p)
  const label = LABELS[p.kind]

  const artifact: Artifact = { kind: 'report', title: label.title, language: label.lang, content }

  const steps: PlanStep[] = [
    { label: 'Analyze request', detail: `Type: ${label.title} · runtime: ${p.runtime} · port: ${p.port}${p.domain ? ` · domain: ${p.domain}` : ''}` },
    { label: 'Apply secure defaults', detail: 'Non-root, least-privilege caps, read-only FS where possible' },
    { label: 'Add health & resilience', detail: 'Healthcheck + restart policy' },
    { label: 'Generate artifact', detail: `${label.title} ready for review` },
    { label: 'Deploy (requires your approval)', detail: 'Nothing is written or applied until you approve' },
  ]

  const plan: TaskPlan = {
    id: `infra_${p.kind}_${p.port}`,
    intent: `infra.${p.kind}`,
    summary: `Generate a hardened ${label.title} for "${p.service}" (${p.runtime}, port ${p.port})`,
    module: 'infra',
    steps,
    requiresApproval: true,
    status: 'proposed',
    artifact,
  }

  return {
    text:
      `I've generated a hardened **${label.title}** for "${p.service}" (${p.runtime}, port ${p.port}). ` +
      `Secure defaults are baked in (non-root, dropped capabilities, healthcheck/restart, TLS + security headers where applicable). ` +
      `Review the steps and approve to mark it deployed — **nothing is written to disk or applied** yet.`,
    module: 'infra',
    plan,
    artifact,
    remember: {
      facts: [`Generated a ${label.title} for ${p.service} (${p.runtime})`],
      preferences: { preferredRuntime: p.runtime },
    },
  }
}
