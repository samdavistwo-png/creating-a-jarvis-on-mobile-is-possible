// JACK — Self-learning Knowledge Base
//
// JACK accumulates knowledge of tools and facts across sessions. The KB is:
//   1. injected into the LLM system prompt (so JACK "knows" what it has learned),
//   2. grown automatically — after each LLM turn JACK extracts newly-encountered
//      tools/facts and persists them,
//   3. grown manually — the user can teach JACK a tool from the Knowledge panel.
//
// This is genuine cross-session learning bounded to localStorage. It never
// modifies JACK's own code (per the spec's self-improvement guardrails).

export interface KnownTool {
  name: string
  category: string
  summary: string
  usage?: string
  source: 'seed' | 'learned' | 'taught'
  learnedAt: number
}

export interface KnowledgeState {
  tools: KnownTool[]
  updatedAt: number
}

const KEY = 'jack.knowledge.v1'

// A broad defensive-security / devops / linux seed so JACK is powerful on
// first run and keeps getting smarter. New entries added here are merged into
// returning users' knowledge automatically (see loadKnowledge) without wiping
// anything they have already learned or been taught.
const SEED: Omit<KnownTool, 'learnedAt'>[] = [
  // — firewall & network filtering —
  { name: 'ufw', category: 'firewall', summary: 'Uncomplicated Firewall — simple front-end for iptables.', usage: 'ufw default deny incoming; ufw allow 22/tcp; ufw enable', source: 'seed' },
  { name: 'nftables', category: 'firewall', summary: 'Modern Linux packet-filtering framework, successor to iptables.', usage: 'nft -f /etc/nftables.conf', source: 'seed' },
  { name: 'iptables', category: 'firewall', summary: 'Classic Linux netfilter packet filter; rules by chain/table.', usage: 'iptables -A INPUT -p tcp --dport 22 -j ACCEPT', source: 'seed' },
  { name: 'firewalld', category: 'firewall', summary: 'Dynamic firewall manager with zones (RHEL/Fedora default).', usage: 'firewall-cmd --add-service=https --permanent; firewall-cmd --reload', source: 'seed' },
  { name: 'crowdsec', category: 'firewall', summary: 'Collaborative, behavior-based IPS that shares attack signals across a community.', usage: 'cscli decisions list; cscli bouncers add nginx', source: 'seed' },

  // — intrusion prevention / detection —
  { name: 'fail2ban', category: 'intrusion-prevention', summary: 'Bans IPs with repeated failed auth attempts by watching logs.', usage: 'edit /etc/fail2ban/jail.local; systemctl enable --now fail2ban', source: 'seed' },
  { name: 'suricata', category: 'intrusion-detection', summary: 'High-performance network IDS/IPS and traffic analysis engine.', usage: 'suricata -c /etc/suricata/suricata.yaml -i eth0', source: 'seed' },
  { name: 'snort', category: 'intrusion-detection', summary: 'Signature-based network intrusion detection/prevention system.', usage: 'snort -A console -q -c /etc/snort/snort.conf -i eth0', source: 'seed' },
  { name: 'wazuh', category: 'intrusion-detection', summary: 'Open-source XDR/SIEM: host intrusion detection, log analysis, FIM.', usage: 'deploy wazuh-agent; view alerts in the Wazuh dashboard', source: 'seed' },
  { name: 'aide', category: 'intrusion-detection', summary: 'Advanced Intrusion Detection Environment — file integrity monitoring.', usage: 'aide --init; aide --check', source: 'seed' },

  // — recon & scanning —
  { name: 'nmap', category: 'recon', summary: 'Network scanner for authorized discovery and port/service auditing.', usage: 'nmap -sV -p- <authorized-host>', source: 'seed' },
  { name: 'masscan', category: 'recon', summary: 'Internet-scale TCP port scanner, extremely fast.', usage: 'masscan <cidr> -p0-65535 --rate 10000', source: 'seed' },
  { name: 'nikto', category: 'web-security', summary: 'Web server scanner for known vulns, misconfig, outdated software.', usage: 'nikto -h https://example.com', source: 'seed' },
  { name: 'gobuster', category: 'web-security', summary: 'Brute-forces URIs, DNS subdomains and vhosts for content discovery.', usage: 'gobuster dir -u https://example.com -w wordlist.txt', source: 'seed' },

  // — vulnerability & dependency scanning —
  { name: 'trivy', category: 'scanner', summary: 'All-in-one scanner for container images, filesystems, IaC and SBOMs.', usage: 'trivy image myapp:latest; trivy fs .', source: 'seed' },
  { name: 'grype', category: 'scanner', summary: 'Vulnerability scanner for container images and filesystems (by Anchore).', usage: 'grype myapp:latest', source: 'seed' },
  { name: 'syft', category: 'sbom', summary: 'Generates a Software Bill of Materials (SBOM) from images/filesystems.', usage: 'syft myapp:latest -o spdx-json', source: 'seed' },
  { name: 'openvas', category: 'scanner', summary: 'Full-featured network vulnerability scanner (Greenbone).', usage: 'run a scan task from the Greenbone Security Assistant UI', source: 'seed' },
  { name: 'osv-scanner', category: 'scanner', summary: 'Scans dependencies against the OSV vulnerability database.', usage: 'osv-scanner -r .', source: 'seed' },

  // — auditing & hardening —
  { name: 'lynis', category: 'audit', summary: 'Security auditing & hardening tool for Linux systems.', usage: 'lynis audit system', source: 'seed' },
  { name: 'openscap', category: 'audit', summary: 'Compliance scanning against SCAP/CIS/STIG baselines.', usage: 'oscap xccdf eval --profile cis ssg-ubuntu.xml', source: 'seed' },
  { name: 'tiger', category: 'audit', summary: 'Classic host-based security audit and intrusion detection toolset.', usage: 'tiger', source: 'seed' },

  // — logging, audit & monitoring —
  { name: 'auditd', category: 'logging', summary: 'Linux audit daemon for tamper-evident system event logging.', usage: 'auditctl -w /etc/passwd -p wa', source: 'seed' },
  { name: 'falco', category: 'runtime-security', summary: 'Runtime threat detection for containers/hosts via kernel syscalls.', usage: 'falco -r /etc/falco/falco_rules.yaml', source: 'seed' },
  { name: 'osquery', category: 'monitoring', summary: 'Query your OS like a SQL database for live security telemetry.', usage: "osqueryi \"select * from listening_ports;\"", source: 'seed' },
  { name: 'prometheus', category: 'monitoring', summary: 'Time-series metrics collection and alerting system.', usage: 'scrape targets; alert via Alertmanager', source: 'seed' },
  { name: 'grafana', category: 'monitoring', summary: 'Dashboards and visualization for metrics, logs and traces.', usage: 'add Prometheus/Loki datasource; build dashboards', source: 'seed' },
  { name: 'loki', category: 'monitoring', summary: 'Log aggregation system designed to pair with Grafana.', usage: 'ship logs via promtail; query with LogQL', source: 'seed' },

  // — malware & forensics —
  { name: 'clamav', category: 'malware', summary: 'Open-source antivirus engine for scanning files for malware.', usage: 'clamscan -r /home', source: 'seed' },
  { name: 'yara', category: 'malware', summary: 'Pattern-matching engine to classify and identify malware samples.', usage: 'yara rules.yar /path/to/sample', source: 'seed' },
  { name: 'volatility', category: 'forensics', summary: 'Memory forensics framework for analyzing RAM dumps.', usage: 'vol.py -f memory.raw windows.pslist', source: 'seed' },
  { name: 'sleuthkit', category: 'forensics', summary: 'Disk and filesystem forensic analysis toolkit (with Autopsy GUI).', usage: 'fls -r image.dd; icat image.dd <inode>', source: 'seed' },
  { name: 'wireshark', category: 'forensics', summary: 'Deep packet capture and protocol analysis (tshark for CLI).', usage: 'tshark -i eth0 -f "port 443"', source: 'seed' },

  // — secrets & credential hygiene —
  { name: 'vault', category: 'secrets', summary: 'HashiCorp Vault — secrets management, dynamic creds, encryption-as-a-service.', usage: 'vault kv put secret/app key=val; vault kv get secret/app', source: 'seed' },
  { name: 'sops', category: 'secrets', summary: 'Encrypts secrets in YAML/JSON files with KMS/age/PGP keys.', usage: 'sops -e secrets.yaml > secrets.enc.yaml', source: 'seed' },
  { name: 'age', category: 'secrets', summary: 'Modern, simple file encryption tool (X25519).', usage: 'age -r <recipient> -o file.age file', source: 'seed' },
  { name: 'gitleaks', category: 'secrets', summary: 'Scans git repos and history for leaked secrets/keys.', usage: 'gitleaks detect --source .', source: 'seed' },
  { name: 'trufflehog', category: 'secrets', summary: 'Finds and verifies leaked credentials across repos and files.', usage: 'trufflehog git file://.', source: 'seed' },

  // — TLS / PKI / crypto —
  { name: 'openssl', category: 'tls', summary: 'Swiss-army knife for TLS/PKI: keys, CSRs, certs, inspection.', usage: 'openssl s_client -connect host:443; openssl x509 -in cert.pem -text', source: 'seed' },
  { name: 'certbot', category: 'tls', summary: "Let's Encrypt client to obtain & auto-renew free TLS certificates.", usage: 'certbot --nginx -d example.com', source: 'seed' },
  { name: 'mkcert', category: 'tls', summary: 'Generates locally-trusted dev certificates with zero config.', usage: 'mkcert example.local', source: 'seed' },
  { name: 'testssl.sh', category: 'tls', summary: 'Checks a server’s TLS/SSL ciphers, protocols and known flaws.', usage: 'testssl.sh https://example.com', source: 'seed' },

  // — identity, access & auth —
  { name: 'openssh', category: 'identity', summary: 'Secure remote login; harden with key-only auth and strong ciphers.', usage: 'ssh-keygen -t ed25519; set PasswordAuthentication no', source: 'seed' },
  { name: 'oauth2-proxy', category: 'identity', summary: 'Reverse-proxy that adds OAuth/OIDC authentication in front of apps.', usage: 'run as sidecar; protect upstream with your IdP', source: 'seed' },
  { name: 'keycloak', category: 'identity', summary: 'Open-source identity & access management (SSO, OIDC, SAML).', usage: 'define realms, clients and roles; issue tokens', source: 'seed' },
  { name: 'fido2/webauthn', category: 'identity', summary: 'Phishing-resistant passwordless auth using hardware/passkeys.', usage: 'register a passkey; verify with navigator.credentials', source: 'seed' },

  // — containers & kubernetes —
  { name: 'docker', category: 'containers', summary: 'Container build/run platform; harden with non-root users and minimal images.', usage: 'docker build -t app .; docker run --read-only --cap-drop ALL app', source: 'seed' },
  { name: 'kube-bench', category: 'kubernetes', summary: 'Checks a Kubernetes cluster against the CIS Benchmark.', usage: 'kube-bench run --targets master,node', source: 'seed' },
  { name: 'kube-hunter', category: 'kubernetes', summary: 'Hunts for security weaknesses in Kubernetes clusters.', usage: 'kube-hunter --remote <cluster-ip>', source: 'seed' },
  { name: 'kyverno', category: 'kubernetes', summary: 'Policy engine for Kubernetes — validate, mutate, generate resources.', usage: 'apply ClusterPolicy to require non-root, drop caps, etc.', source: 'seed' },
  { name: 'opa', category: 'policy', summary: 'Open Policy Agent — general-purpose policy-as-code engine (Rego).', usage: 'opa eval -d policy.rego -i input.json "data.authz.allow"', source: 'seed' },

  // — infrastructure-as-code security —
  { name: 'checkov', category: 'iac-security', summary: 'Static analysis for Terraform/CloudFormation/K8s misconfigurations.', usage: 'checkov -d .', source: 'seed' },
  { name: 'tfsec', category: 'iac-security', summary: 'Security scanner for Terraform code (now part of Trivy).', usage: 'tfsec .', source: 'seed' },
  { name: 'semgrep', category: 'sast', summary: 'Fast, multi-language static analysis with custom rules (SAST).', usage: 'semgrep --config auto .', source: 'seed' },

  // — backup & resilience —
  { name: 'restic', category: 'backup', summary: 'Fast, encrypted, deduplicated backups to many storage backends.', usage: 'restic -r repo backup /data; restic restore latest', source: 'seed' },
  { name: 'borgbackup', category: 'backup', summary: 'Deduplicating, compressed, authenticated-encryption backups.', usage: 'borg create repo::archive /data', source: 'seed' },

  // — VPN & secure networking —
  { name: 'wireguard', category: 'vpn', summary: 'Modern, fast, minimal-config VPN using state-of-the-art crypto.', usage: 'wg-quick up wg0', source: 'seed' },
  { name: 'tailscale', category: 'vpn', summary: 'Zero-config mesh VPN built on WireGuard with identity-based ACLs.', usage: 'tailscale up; define ACLs in the admin console', source: 'seed' },

  // — security concepts (not tools, but JACK should "know" them) —
  { name: 'defense-in-depth', category: 'concept', summary: 'Layer independent controls so no single failure is catastrophic.', source: 'seed' },
  { name: 'least-privilege', category: 'concept', summary: 'Grant the minimum permissions needed, for the shortest time.', source: 'seed' },
  { name: 'zero-trust', category: 'concept', summary: 'Never trust by network location; verify identity & device for every request.', source: 'seed' },
  { name: 'threat-modeling', category: 'concept', summary: 'Systematically enumerate assets, threats and mitigations (e.g. STRIDE).', source: 'seed' },
  { name: 'cis-benchmarks', category: 'concept', summary: 'Consensus secure-configuration baselines for OS/cloud/containers.', source: 'seed' },
  { name: 'mitre-attack', category: 'concept', summary: 'Knowledge base of adversary tactics & techniques for defense mapping.', source: 'seed' },

  // — programming languages & runtimes —
  { name: 'typescript', category: 'language', summary: 'Typed superset of JavaScript that compiles to plain JS; catches errors at build time.', usage: 'tsc --noEmit', source: 'seed' },
  { name: 'python', category: 'language', summary: 'Readable general-purpose language; dominant in scripting, data science and AI.', usage: 'python3 main.py', source: 'seed' },
  { name: 'rust', category: 'language', summary: 'Memory-safe systems language with no GC; ownership model prevents data races.', usage: 'cargo run', source: 'seed' },
  { name: 'go', category: 'language', summary: 'Compiled, concurrent language with goroutines; great for network services.', usage: 'go run .', source: 'seed' },
  { name: 'bun', category: 'runtime', summary: 'Fast all-in-one JS runtime, bundler, test runner and package manager.', usage: 'bun run dev', source: 'seed' },
  { name: 'nodejs', category: 'runtime', summary: 'JavaScript runtime built on V8 for servers and tooling.', usage: 'node server.js', source: 'seed' },

  // — web & frameworks —
  { name: 'react', category: 'frontend', summary: 'Component-based UI library using a virtual DOM and hooks.', usage: 'useState/useEffect; render components', source: 'seed' },
  { name: 'vite', category: 'frontend', summary: 'Fast dev server + build tool using native ESM and esbuild/Rollup.', usage: 'vite dev', source: 'seed' },
  { name: 'tailwind', category: 'frontend', summary: 'Utility-first CSS framework for building UI without leaving HTML.', usage: 'class="flex gap-2 p-4"', source: 'seed' },
  { name: 'web-speech-api', category: 'frontend', summary: 'Browser API for speech recognition (STT) and synthesis (TTS) — powers JACK voice.', usage: 'new SpeechRecognition(); speechSynthesis.speak(...)', source: 'seed' },
  { name: 'pwa', category: 'frontend', summary: 'Progressive Web App: installable, offline-capable web app via manifest + service worker.', usage: 'add manifest.webmanifest + sw.js', source: 'seed' },
  { name: 'rest-api', category: 'web', summary: 'HTTP API style using verbs (GET/POST/...) and resources; stateless.', usage: 'GET /users/1', source: 'seed' },
  { name: 'graphql', category: 'web', summary: 'Query language for APIs; clients request exactly the fields they need.', usage: 'query { user(id:1){ name } }', source: 'seed' },
  { name: 'websocket', category: 'web', summary: 'Full-duplex persistent connection for real-time data over one TCP socket.', usage: 'new WebSocket(url)', source: 'seed' },

  // — data & cloud —
  { name: 'postgresql', category: 'database', summary: 'Powerful open-source relational database with strong SQL and JSON support.', usage: 'psql; SELECT * FROM t;', source: 'seed' },
  { name: 'redis', category: 'database', summary: 'In-memory key-value store for caching, queues and pub/sub.', usage: 'redis-cli SET k v', source: 'seed' },
  { name: 'sqlite', category: 'database', summary: 'Serverless, file-based SQL database; perfect for local/embedded use.', usage: 'sqlite3 app.db', source: 'seed' },
  { name: 'aws', category: 'cloud', summary: 'Amazon Web Services — broad cloud platform (EC2, S3, Lambda, RDS, ...).', source: 'seed' },
  { name: 'cloudflare', category: 'cloud', summary: 'CDN, DNS, DDoS protection and edge compute (Workers/Pages).', source: 'seed' },
  { name: 'github-actions', category: 'devops', summary: 'CI/CD that runs workflows on GitHub events (push/PR) — JACK deploys via it.', usage: '.github/workflows/*.yml', source: 'seed' },
  { name: 'git', category: 'devops', summary: 'Distributed version control; branch, commit, merge, and collaborate.', usage: 'git commit -m "..."; git push', source: 'seed' },

  // — AI / LLM —
  { name: 'llm', category: 'ai', summary: 'Large Language Model — predicts text; powers chat, reasoning and tool use.', source: 'seed' },
  { name: 'prompt-engineering', category: 'ai', summary: 'Designing inputs/instructions to get reliable, high-quality model outputs.', source: 'seed' },
  { name: 'rag', category: 'ai', summary: 'Retrieval-Augmented Generation: ground an LLM with fetched documents/knowledge.', source: 'seed' },
  { name: 'embeddings', category: 'ai', summary: 'Vector representations of text enabling semantic search and similarity.', source: 'seed' },
  { name: 'function-calling', category: 'ai', summary: 'Letting an LLM invoke defined tools/APIs with structured arguments.', source: 'seed' },
]

export function loadKnowledge(): KnowledgeState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw) as KnowledgeState
    if (!parsed?.tools?.length) return seedState()
    return mergeNewSeeds(parsed)
  } catch {
    return seedState()
  }
}

/** Merge any seed tools that didn't exist when this user first loaded JACK.
 * Existing tools (learned/taught/old seeds) are preserved untouched, so the
 * assistant keeps getting smarter across releases without losing memory. */
function mergeNewSeeds(state: KnowledgeState): KnowledgeState {
  const have = new Set(state.tools.map((t) => t.name.toLowerCase()))
  const missing = SEED.filter((t) => !have.has(t.name.toLowerCase()))
  if (!missing.length) return state
  const now = Date.now()
  const next: KnowledgeState = {
    tools: [...state.tools, ...missing.map((t) => ({ ...t, learnedAt: now }))].slice(-200),
    updatedAt: now,
  }
  saveKnowledge(next)
  console.log('JACK knowledge: merged', missing.length, 'new seed tools')
  return next
}

function seedState(): KnowledgeState {
  const now = Date.now()
  const state: KnowledgeState = {
    tools: SEED.map((t) => ({ ...t, learnedAt: now })),
    updatedAt: now,
  }
  saveKnowledge(state)
  return state
}

export function saveKnowledge(state: KnowledgeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('JACK knowledge: failed to save', err)
  }
}

/** Merge new tools, de-duplicating by name (case-insensitive). Returns
 * {state, added} where added lists names that were genuinely new. */
export function learnTools(
  state: KnowledgeState,
  incoming: Array<Partial<KnownTool> & { name: string; summary: string }>,
  source: KnownTool['source'] = 'learned',
): { state: KnowledgeState; added: string[] } {
  const byName = new Map(state.tools.map((t) => [t.name.toLowerCase(), t]))
  const added: string[] = []
  const now = Date.now()
  for (const t of incoming) {
    const key = t.name.trim().toLowerCase()
    if (!key || byName.has(key)) continue
    const tool: KnownTool = {
      name: t.name.trim(),
      category: (t.category || 'general').trim(),
      summary: t.summary.trim(),
      usage: t.usage?.trim(),
      source,
      learnedAt: now,
    }
    byName.set(key, tool)
    added.push(tool.name)
  }
  // Bound to most-recent 200 tools.
  const tools = Array.from(byName.values()).slice(-200)
  const next: KnowledgeState = { tools, updatedAt: now }
  if (added.length) saveKnowledge(next)
  return { state: next, added }
}

export function forgetTool(state: KnowledgeState, name: string): KnowledgeState {
  const next: KnowledgeState = {
    tools: state.tools.filter((t) => t.name.toLowerCase() !== name.toLowerCase()),
    updatedAt: Date.now(),
  }
  saveKnowledge(next)
  return next
}

/** Compact knowledge summary for the LLM system prompt. */
export function knowledgeContext(state: KnowledgeState, limit = 60): string {
  if (!state.tools.length) return '(none yet)'
  return state.tools
    .slice(-limit)
    .map((t) => `- ${t.name} [${t.category}]: ${t.summary}${t.usage ? ` (e.g. ${t.usage})` : ''}`)
    .join('\n')
}
